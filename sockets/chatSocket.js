const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const Chat = require("../models/chatModel");
const { User } = require("../models");
const { setIO, getIO } = require("./socketRegistry");
const { extractBearerOrRawToken } = require("../middlewares/authMiddleware");

require("dotenv").config({ quiet: true });

const STORE_ROOM = "store:team";

function userRoom(userId) {
    return `user:${userId}`;
}

function conversationRoom(conversationId) {
    return `conversation:${conversationId}`;
}

function extractToken(socket) {
    const authToken = socket.handshake.auth && socket.handshake.auth.token;
    const queryToken = socket.handshake.query && socket.handshake.query.token;
    const authHeader = socket.handshake.headers.authorization || "";

    if (authToken) return String(authToken).trim();
    if (queryToken) return String(queryToken).trim();
    return extractBearerOrRawToken(authHeader);
}

async function authenticateSocket(socket, next) {
    const token = extractToken(socket);

    if (!token) {
        return next(new Error("Bạn cần đăng nhập để sử dụng chat realtime."));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
        const user = await User.findByPk(decoded.id);

        if (!user || user.status !== "active") {
            return next(new Error("Tài khoản không thể dùng chat realtime."));
        }

        socket.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status
        };

        return next();
    } catch (error) {
        return next(new Error("Token chat realtime không hợp lệ hoặc đã hết hạn."));
    }
}

function emitToConversationAudience(io, conversation) {
    let emitter = io
        .to(conversationRoom(conversation.id))
        .to(userRoom(conversation.customer.id))
        .to(STORE_ROOM);

    if (conversation.assigned_staff && conversation.assigned_staff.id) {
        emitter = emitter.to(userRoom(conversation.assigned_staff.id));
    }

    return emitter;
}

function emitNewMessage(message) {
    const io = getIO();

    if (!io || !message || !message.conversation) {
        return;
    }

    emitToConversationAudience(io, message.conversation).emit("chat:message:new", message);
    emitToConversationAudience(io, message.conversation).emit("chat:conversation:updated", message.conversation);
}

function emitMessagesRead(payload) {
    const io = getIO();

    if (!io || !payload || !payload.conversation_id) {
        return;
    }

    io.to(conversationRoom(payload.conversation_id)).to(STORE_ROOM).emit("chat:messages:read", payload);
}

function safeAck(callback, payload) {
    if (typeof callback === "function") {
        callback(payload);
    }
}

function initializeChatSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: true,
            credentials: true
        }
    });

    setIO(io);
    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        socket.join(userRoom(socket.user.id));

        if (["admin", "staff"].includes(socket.user.role)) {
            socket.join(STORE_ROOM);
        }

        socket.on("chat:join", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã hội thoại không hợp lệ.");
                }

                const conversation = await Chat.getConversationByIdForUser(conversationId, socket.user);

                if (!conversation) {
                    throw new Error("Không tìm thấy hội thoại.");
                }

                socket.join(conversationRoom(conversation.id));
                safeAck(callback, { success: true, conversation });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không thể tham gia hội thoại." });
            }
        });

        socket.on("chat:leave", (payload = {}, callback) => {
            const conversationId = Number(payload.conversation_id);

            if (Number.isInteger(conversationId) && conversationId > 0) {
                socket.leave(conversationRoom(conversationId));
            }

            safeAck(callback, { success: true });
        });

        socket.on("chat:message:send", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã hội thoại không hợp lệ.");
                }

                const message = await Chat.createMessage(conversationId, socket.user, payload);
                emitNewMessage(message);
                safeAck(callback, { success: true, data: message });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không thể gửi tin nhắn." });
            }
        });

        socket.on("chat:messages:read", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã hội thoại không hợp lệ.");
                }

                const result = await Chat.markConversationAsRead(conversationId, socket.user);
                const emitPayload = {
                    conversation_id: conversationId,
                    reader_id: socket.user.id,
                    reader_role: socket.user.role,
                    ...result
                };

                emitMessagesRead(emitPayload);
                safeAck(callback, { success: true, data: emitPayload });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không thể đánh dấu đã đọc." });
            }
        });
    });

    return io;
}

module.exports = {
    initializeChatSocket,
    emitNewMessage,
    emitMessagesRead,
    userRoom,
    conversationRoom,
    STORE_ROOM
};
