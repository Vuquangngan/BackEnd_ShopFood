const { Notification } = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

function toPlain(instance) {
    if (!instance) return null;
    return instance.get ? instance.get({ plain: true }) : instance;
}

function localizeNotification(notification) {
    if (!notification) return null;

    const localized = addVietnameseLabels(notification, {
        type: "notification_type"
    });

    return addVietnameseAliases(localized, {
        user_id: "ma_nguoi_nhan",
        type: "loai_thong_bao_ma",
        type_label: "loai_thong_bao_hien_thi",
        title: "tieu_de",
        message: "noi_dung",
        metadata: "du_lieu_bo_sung",
        is_read: "da_doc",
        read_at: "thoi_gian_doc",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

const NotificationModel = {
    async listForUser(userId, filters = {}) {
        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
        const offset = (page - 1) * limit;
        const where = { user_id: userId };

        if (filters.is_read === "true") {
            where.is_read = true;
        } else if (filters.is_read === "false") {
            where.is_read = false;
        }

        const { rows, count } = await Notification.findAndCountAll({
            where,
            order: [["created_at", "DESC"]],
            limit,
            offset
        });

        const unreadCount = await Notification.count({
            where: {
                user_id: userId,
                is_read: false
            }
        });

        return {
            items: rows.map((item) => localizeNotification(toPlain(item))),
            danh_sach_thong_bao: rows.map((item) => localizeNotification(toPlain(item))),
            pagination: addVietnameseAliases({
                page,
                limit,
                total: count,
                total_pages: Math.max(Math.ceil(count / limit), 1)
            }, {
                total_pages: "tong_so_trang"
            }),
            unread_count: unreadCount,
            so_thong_bao_chua_doc: unreadCount
        };
    },

    async markAsRead(userId, notificationId) {
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                user_id: userId
            }
        });

        if (!notification) return null;

        if (!notification.is_read) {
            await notification.update({
                is_read: true,
                read_at: new Date()
            });
        }

        return localizeNotification(toPlain(notification));
    },

    async markAllAsRead(userId) {
        await Notification.update(
            {
                is_read: true,
                read_at: new Date()
            },
            {
                where: {
                    user_id: userId,
                    is_read: false
                }
            }
        );

        const unreadCount = await Notification.count({
            where: {
                user_id: userId,
                is_read: false
            }
        });

        return {
            unread_count: unreadCount,
            so_thong_bao_chua_doc: unreadCount
        };
    },

    async countUnread(userId) {
        const unreadCount = await Notification.count({
            where: {
                user_id: userId,
                is_read: false
            }
        });

        return {
            unread_count: unreadCount,
            so_thong_bao_chua_doc: unreadCount
        };
    },

    localizeNotification
};

module.exports = NotificationModel;
