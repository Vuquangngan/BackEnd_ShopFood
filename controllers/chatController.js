const Chat = require("../models/chatModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { emitNewMessage, emitMessagesRead } = require("../sockets/chatSocket");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    return res.status(error.status || 500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getConversations = async (req, res) => {
    try {
        const conversations = await Chat.listConversations(req.user, req.query);
        return res.json(conversations);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.createOrGetConversation = async (req, res) => {
    try {
        const conversation = await Chat.getOrCreateConversation(req.user, req.body);
        return res.status(201).json(conversation);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getConversationById = async (req, res) => {
    try {
        const conversationId = parseId(req.params.id);

        if (!conversationId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã hội thoại không hợp lệ."
            }));
        }

        const conversation = await Chat.getConversationByIdForUser(conversationId, req.user);

        if (!conversation) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy hội thoại."
            }));
        }

        return res.json(conversation);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getMessages = async (req, res) => {
    try {
        const conversationId = parseId(req.params.id);

        if (!conversationId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã hội thoại không hợp lệ."
            }));
        }

        const payload = await Chat.listMessages(conversationId, req.user, req.query);
        return res.json(payload);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const conversationId = parseId(req.params.id);

        if (!conversationId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã hội thoại không hợp lệ."
            }));
        }

        const message = await Chat.createMessage(conversationId, req.user, req.body);
        emitNewMessage(message);
        return res.status(201).json(message);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const conversationId = parseId(req.params.id);

        if (!conversationId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã hội thoại không hợp lệ."
            }));
        }

        const payload = await Chat.markConversationAsRead(conversationId, req.user);
        emitMessagesRead({
            conversation_id: conversationId,
            reader_id: req.user.id,
            reader_role: req.user.role,
            ...payload
        });
        return res.json(payload);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const conversationId = parseId(req.params.id);

        if (!conversationId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã hội thoại không hợp lệ."
            }));
        }

        const conversation = await Chat.updateConversationStatus(conversationId, req.user, req.body.status);
        return res.json(conversation);
    } catch (error) {
        return handleError(res, error);
    }
};
