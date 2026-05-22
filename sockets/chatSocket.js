const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const Chat = require("../models/chatModel");
const { User } = require("../models");
const { setIO, getIO } = require("./socketRegistry");
const { extractBearerOrRawToken } = require("../middlewares/authMiddleware");

require("dotenv").config({ quiet: true });

const STORE_ROOM = "store:team";
const onlineUserCounts = new Map();
let onlineStoreCount = 0;

function userRoom(userId) {
    return `user:${userId}`;
}

function conversationRoom(conversationId) {
    return `conversation:${conversationId}`;
}

function isStoreOnline() {
    return onlineStoreCount > 0;
}

function isUserOnline(userId) {
    return Number(onlineUserCounts.get(Number(userId)) || 0) > 0;
}

function markUserConnected(user) {
    const userId = Number(user?.id || 0);
    if (!userId) return;

    onlineUserCounts.set(userId, Number(onlineUserCounts.get(userId) || 0) + 1);
    if (["admin", "staff"].includes(String(user.role || "").toLowerCase())) {
        onlineStoreCount += 1;
    }
}

function markUserDisconnected(user) {
    const userId = Number(user?.id || 0);
    if (!userId) return;

    const nextCount = Number(onlineUserCounts.get(userId) || 0) - 1;
    if (nextCount > 0) {
        onlineUserCounts.set(userId, nextCount);
    } else {
        onlineUserCounts.delete(userId);
    }

    if (["admin", "staff"].includes(String(user.role || "").toLowerCase())) {
        onlineStoreCount = Math.max(0, onlineStoreCount - 1);
    }
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
        return next(new Error("B?n c?n dang nh?p d? s? d?ng chat ."));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
        const user = await User.findByPk(decoded.id);

        if (!user || user.status !== "active") {
            return next(new Error("Tài kho?n không th? dùng chat ."));
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
        return next(new Error("Token chat realtime không h?p l? ho?c dã h?t h?n."));
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

function emitUserPresence(io, user, isOnline) {
    if (!io || !user?.id) return;

    io.to(STORE_ROOM).to(userRoom(user.id)).emit("chat:presence", {
        user_id: user.id,
        role: user.role,
        username: user.username,
        is_online: Boolean(isOnline)
    });
}

function emitStorePresence(io) {
    if (!io) return;

    io.emit("chat:store:presence", {
        is_online: isStoreOnline(),
        online_count: onlineStoreCount
    });
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
        markUserConnected(socket.user);

        if (["admin", "staff"].includes(socket.user.role)) {
            socket.join(STORE_ROOM);
        }

        emitUserPresence(io, socket.user, true);
        emitStorePresence(io);

        socket.on("chat:join", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã h?i tho?i không h?p l?.");
                }

                const conversation = await Chat.getConversationByIdForUser(conversationId, socket.user);

                if (!conversation) {
                    throw new Error("Không tìm th?y h?i tho?i.");
                }

                socket.join(conversationRoom(conversation.id));
                safeAck(callback, {
                    success: true,
                    conversation,
                    presence: {
                        customer_online: isUserOnline(conversation.customer?.id),
                        store_online: isStoreOnline(),
                        assigned_staff_online: isUserOnline(conversation.assigned_staff?.id)
                    }
                });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không th? tham gia h?i tho?i." });
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
                    throw new Error("Mã h?i tho?i không h?p l?.");
                }

                const message = await Chat.createMessage(conversationId, socket.user, payload);
                emitNewMessage(message);
                safeAck(callback, { success: true, data: message });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không th? g?i tin nh?n." });
            }
        });

        socket.on("chat:messages:read", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã h?i tho?i không h?p l?.");
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
                safeAck(callback, { success: false, message: error.message || "Không th? dánh d?u dã d?c." });
            }
        });

        socket.on("chat:typing", async (payload = {}, callback) => {
            try {
                const conversationId = Number(payload.conversation_id);

                if (!Number.isInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Mã h?i tho?i không h?p l?.");
                }

                const conversation = await Chat.getConversationByIdForUser(conversationId, socket.user);
                if (!conversation) {
                    throw new Error("Không tìm th?y h?i tho?i.");
                }

                const typingPayload = {
                    conversation_id: conversationId,
                    user_id: socket.user.id,
                    role: socket.user.role,
                    username: socket.user.username,
                    is_typing: Boolean(payload.is_typing)
                };

                emitToConversationAudience(io, conversation).emit("chat:typing", typingPayload);
                safeAck(callback, { success: true, data: typingPayload });
            } catch (error) {
                safeAck(callback, { success: false, message: error.message || "Không th? c?p nh?t tr?ng thái gõ." });
            }
        });

        socket.on("disconnect", () => {
            markUserDisconnected(socket.user);
            emitUserPresence(io, socket.user, false);
            emitStorePresence(io);
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
