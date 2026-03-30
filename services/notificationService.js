const { Op } = require("sequelize");
const { Notification, User } = require("../models");
const NotificationModel = require("../models/notificationModel");
const { getIO } = require("../sockets/socketRegistry");

function userRoom(userId) {
    return `user:${userId}`;
}

async function emitNotification(notification) {
    const io = getIO();
    if (!io || !notification) return;

    io.to(userRoom(notification.user_id)).emit("notification:new", notification);

    const unreadCount = await Notification.count({
        where: {
            user_id: notification.user_id,
            is_read: false
        }
    });

    io.to(userRoom(notification.user_id)).emit("notification:unread-count", {
        unread_count: unreadCount,
        so_thong_bao_chua_doc: unreadCount
    });
}

async function createForUsers(userIds, payload = {}) {
    const uniqueUserIds = [...new Set((userIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!uniqueUserIds.length) return [];

    const notifications = await Notification.bulkCreate(
        uniqueUserIds.map((userId) => ({
            user_id: userId,
            type: payload.type || "system",
            title: payload.title || "Thông báo mới",
            message: payload.message || "Bạn có một thông báo mới.",
            metadata: payload.metadata || null
        })),
        { returning: true }
    );

    const localized = notifications.map((item) => NotificationModel.localizeNotification(item.get({ plain: true })));
    await Promise.all(localized.map((item) => emitNotification(item)));
    return localized;
}

async function createForUser(userId, payload = {}) {
    const [notification] = await createForUsers([userId], payload);
    return notification || null;
}

async function createForRoles(roles = [], payload = {}) {
    const users = await User.findAll({
        where: {
            role: { [Op.in]: roles },
            status: "active"
        },
        attributes: ["id"]
    });

    return createForUsers(users.map((user) => user.id), payload);
}

module.exports = {
    createForUser,
    createForUsers,
    createForRoles
};
