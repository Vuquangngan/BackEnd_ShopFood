const { Op } = require("sequelize");
const {
    sequelize,
    User,
    ChatConversation,
    ChatMessage
} = require("./index");
const { addVietnameseAliases, getVietnameseLabel } = require("../utils/vietnameseLabels");
const { createForRoles, createForUser } = require("../services/notificationService");

const CONVERSATION_STATUS_LABELS = {
    open: "Đang mở",
    closed: "Đã đóng"
};

const MESSAGE_TYPE_LABELS = {
    text: "Văn bản",
    image: "Hình ảnh",
    system: "Hệ thống"
};

function toPlain(instance) {
    if (!instance) return null;
    return instance.get ? instance.get({ plain: true }) : instance;
}

function getConversationStatusLabel(status) {
    return CONVERSATION_STATUS_LABELS[status] || status;
}

function getMessageTypeLabel(messageType) {
    return MESSAGE_TYPE_LABELS[messageType] || messageType;
}

function localizeUser(user) {
    if (!user) return null;

    return addVietnameseAliases({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url || null,
        role: user.role,
        role_label: getVietnameseLabel("user_role", user.role),
        status: user.status,
        status_label: getVietnameseLabel("user_status", user.status)
    }, {
        username: "ten_nguoi_dung",
        avatar_url: "anh_dai_dien",
        role: "vai_tro_ma",
        role_label: "vai_tro_hien_thi",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi"
    });
}

function localizeConversation(conversation) {
    if (!conversation) return null;

    const localized = addVietnameseAliases({
        ...conversation,
        status_label: getConversationStatusLabel(conversation.status),
        customer: localizeUser(conversation.customer),
        assigned_staff: localizeUser(conversation.assigned_staff),
        unread_count: Number(conversation.unread_count || 0)
    }, {
        customer_id: "ma_khach_hang",
        assigned_staff_id: "ma_nhan_vien_phu_trach",
        subject: "chu_de",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi",
        last_message_preview: "xem_truoc_tin_nhan_cuoi",
        last_message_at: "thoi_gian_tin_nhan_cuoi",
        unread_count: "so_tin_nhan_chua_doc",
        customer: "khach_hang",
        assigned_staff: "nhan_vien_phu_trach",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });

    return {
        ...localized,
        customer: localized.customer,
        khach_hang: localized.customer,
        assigned_staff: localized.assigned_staff,
        nhan_vien_phu_trach: localized.assigned_staff
    };
}

function localizeMessage(message) {
    if (!message) return null;

    const localized = addVietnameseAliases({
        ...message,
        message_type_label: getMessageTypeLabel(message.message_type),
        sender: localizeUser(message.sender)
    }, {
        conversation_id: "ma_hoi_thoai",
        sender_id: "ma_nguoi_gui",
        sender_role: "vai_tro_nguoi_gui_ma",
        message_type: "loai_tin_nhan_ma",
        message_type_label: "loai_tin_nhan_hien_thi",
        content: "noi_dung",
        attachment_url: "tep_dinh_kem",
        is_read: "da_doc",
        read_at: "thoi_gian_doc",
        sender: "nguoi_gui",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });

    return {
        ...localized,
        sender: localized.sender,
        nguoi_gui: localized.sender
    };
}

function buildConversationInclude() {
    return [
        {
            model: User,
            as: "customer",
            attributes: ["id", "username", "email", "avatar_url", "role", "status"]
        },
        {
            model: User,
            as: "assigned_staff",
            attributes: ["id", "username", "email", "avatar_url", "role", "status"]
        }
    ];
}

async function getUnreadCount(conversationId, actorId) {
    return ChatMessage.count({
        where: {
            conversation_id: conversationId,
            is_read: false,
            sender_id: { [Op.ne]: actorId }
        }
    });
}

async function attachUnreadCount(conversation, actorId) {
    const plainConversation = toPlain(conversation);
    if (!plainConversation) return null;

    return {
        ...plainConversation,
        unread_count: actorId ? await getUnreadCount(plainConversation.id, actorId) : 0
    };
}

async function attachUnreadCounts(conversations, actorId) {
    return Promise.all(conversations.map((conversation) => attachUnreadCount(conversation, actorId)));
}

function normalizeMessagePayload(data = {}) {
    const messageType = ["text", "image", "system"].includes(data.message_type) ? data.message_type : "text";
    const content = String(data.content || "").trim();
    const attachmentUrl = data.attachment_url ? String(data.attachment_url).trim() : null;

    if (!content && !attachmentUrl) {
        const error = new Error("Vui lòng nhập nội dung tin nhắn hoặc đường dẫn tệp đính kèm.");
        error.status = 400;
        throw error;
    }

    return {
        message_type: attachmentUrl && !content ? "image" : messageType,
        content: content || "Đã gửi một tệp đính kèm.",
        attachment_url: attachmentUrl
    };
}

async function findConversationByIdForActor(conversationId, actor) {
    const where = { id: conversationId };

    if (actor.role === "customer") {
        where.customer_id = actor.id;
    }

    return ChatConversation.findOne({
        where,
        include: buildConversationInclude()
    });
}

async function notifyConversationAudience(conversation, actor, message) {
    if (!conversation || !message) return;

    if (actor.role === "customer") {
        if (conversation.assigned_staff_id) {
            await createForUser(conversation.assigned_staff_id, {
                type: "chat",
                title: "Khách hàng vừa gửi tin nhắn",
                message: `${actor.username} vừa nhắn: ${String(message.content).slice(0, 120)}`,
                metadata: {
                    conversation_id: conversation.id,
                    sender_id: actor.id
                }
            });
            return;
        }

        await createForRoles(["admin", "staff"], {
            type: "chat",
            title: "Có hội thoại cần phản hồi",
            message: `${actor.username} vừa gửi tin nhắn mới tới cửa hàng.`,
            metadata: {
                conversation_id: conversation.id,
                sender_id: actor.id
            }
        });
        return;
    }

    await createForUser(conversation.customer_id, {
        type: "chat",
        title: "Shop vừa phản hồi tin nhắn",
        message: `${actor.username} vừa phản hồi: ${String(message.content).slice(0, 120)}`,
        metadata: {
            conversation_id: conversation.id,
            sender_id: actor.id
        }
    });
}

const ChatModel = {
    async getOrCreateConversation(actor, data = {}) {
        let customerId = actor.id;

        if (actor.role !== "customer") {
            customerId = Number(data.customer_id);

            if (!Number.isInteger(customerId) || customerId <= 0) {
                const error = new Error("Vui lòng chọn khách hàng cần tạo hội thoại.");
                error.status = 400;
                throw error;
            }
        }

        const customer = await User.findByPk(customerId);

        if (!customer || customer.role !== "customer") {
            const error = new Error("Không tìm thấy khách hàng để mở hội thoại.");
            error.status = 404;
            throw error;
        }

        let conversation = await ChatConversation.findOne({
            where: {
                customer_id: customerId,
                status: "open"
            },
            include: buildConversationInclude(),
            order: [["last_message_at", "DESC"], ["updated_at", "DESC"]]
        });

        if (!conversation) {
            conversation = await ChatConversation.create({
                customer_id: customerId,
                assigned_staff_id: actor.role === "customer" ? null : actor.id,
                subject: data.subject ? String(data.subject).trim() : "Khách cần hỗ trợ"
            });

            conversation = await ChatConversation.findByPk(conversation.id, {
                include: buildConversationInclude()
            });
        }

        return localizeConversation(await attachUnreadCount(conversation, actor.id));
    },

    async listConversations(actor, filters = {}) {
        const where = {};

        if (actor.role === "customer") {
            where.customer_id = actor.id;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        const conversations = await ChatConversation.findAll({
            where,
            include: buildConversationInclude(),
            order: [["last_message_at", "DESC"], ["updated_at", "DESC"]]
        });

        const withUnread = await attachUnreadCounts(conversations, actor.id);
        return withUnread.map(localizeConversation);
    },

    async getConversationByIdForUser(conversationId, actor) {
        const conversation = await findConversationByIdForActor(conversationId, actor);
        if (!conversation) return null;

        return localizeConversation(await attachUnreadCount(conversation, actor.id));
    },

    async getConversationById(conversationId) {
        const conversation = await ChatConversation.findByPk(conversationId, {
            include: buildConversationInclude()
        });

        return localizeConversation(toPlain(conversation));
    },

    async listMessages(conversationId, actor, pagination = {}) {
        const conversation = await findConversationByIdForActor(conversationId, actor);

        if (!conversation) {
            const error = new Error("Không tìm thấy hội thoại.");
            error.status = 404;
            throw error;
        }

        const limit = Math.min(Math.max(Number(pagination.limit) || 30, 1), 100);
        const page = Math.max(Number(pagination.page) || 1, 1);
        const offset = (page - 1) * limit;

        const { rows, count } = await ChatMessage.findAndCountAll({
            where: { conversation_id: conversationId },
            include: [
                {
                    model: User,
                    as: "sender",
                    attributes: ["id", "username", "email", "avatar_url", "role", "status"]
                }
            ],
            order: [["created_at", "ASC"]],
            limit,
            offset
        });

        return {
            conversation: localizeConversation(await attachUnreadCount(conversation, actor.id)),
            messages: rows.map((message) => localizeMessage(toPlain(message))),
            pagination: addVietnameseAliases({
                page,
                limit,
                total: count,
                total_pages: Math.max(Math.ceil(count / limit), 1)
            }, {
                total_pages: "tong_so_trang"
            })
        };
    },

    async createMessage(conversationId, actor, data = {}) {
        const payload = normalizeMessagePayload(data);
        let messageId;

        await sequelize.transaction(async (transaction) => {
            const conversation = await ChatConversation.findByPk(conversationId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!conversation) {
                const error = new Error("Không tìm thấy hội thoại.");
                error.status = 404;
                throw error;
            }

            if (actor.role === "customer" && conversation.customer_id !== actor.id) {
                const error = new Error("Bạn không có quyền gửi tin nhắn vào hội thoại này.");
                error.status = 403;
                throw error;
            }

            const message = await ChatMessage.create({
                conversation_id: conversationId,
                sender_id: actor.id,
                sender_role: actor.role,
                message_type: payload.message_type,
                content: payload.content,
                attachment_url: payload.attachment_url,
                is_read: false
            }, { transaction });

            messageId = message.id;

            await conversation.update({
                assigned_staff_id: actor.role === "customer"
                    ? conversation.assigned_staff_id
                    : (conversation.assigned_staff_id || actor.id),
                status: "open",
                last_message_preview: String(payload.content).slice(0, 255),
                last_message_at: new Date()
            }, { transaction });
        });

        const message = await ChatMessage.findByPk(messageId, {
            include: [
                {
                    model: User,
                    as: "sender",
                    attributes: ["id", "username", "email", "avatar_url", "role", "status"]
                },
                {
                    model: ChatConversation,
                    as: "conversation",
                    include: buildConversationInclude()
                }
            ]
        });

        const plainMessage = toPlain(message);
        await notifyConversationAudience(plainMessage.conversation, actor, plainMessage);

        const conversation = localizeConversation(toPlain(plainMessage.conversation));

        return {
            ...localizeMessage(plainMessage),
            conversation
        };
    },

    async markConversationAsRead(conversationId, actor) {
        const conversation = await findConversationByIdForActor(conversationId, actor);

        if (!conversation) {
            const error = new Error("Không tìm thấy hội thoại.");
            error.status = 404;
            throw error;
        }

        const [updatedCount] = await ChatMessage.update({
            is_read: true,
            read_at: new Date()
        }, {
            where: {
                conversation_id: conversationId,
                is_read: false,
                sender_id: { [Op.ne]: actor.id }
            }
        });

        return addVietnameseAliases({
            conversation_id: conversationId,
            read_count: updatedCount
        }, {
            conversation_id: "ma_hoi_thoai",
            read_count: "so_tin_nhan_da_danh_dau_doc"
        });
    }
};

module.exports = ChatModel;
