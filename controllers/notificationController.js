const Notification = require("../models/notificationModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.listForUser(req.user.id, req.query);
        return res.json(notifications);
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể lấy danh sách thông báo."
        }));
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const payload = await Notification.countUnread(req.user.id);
        return res.json(payload);
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể lấy số lượng thông báo chưa đọc."
        }));
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã thông báo không hợp lệ."
            }));
        }

        const notification = await Notification.markAsRead(req.user.id, id);
        if (!notification) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy thông báo."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đã đánh dấu thông báo là đã đọc.",
            notification,
            thong_bao_chi_tiet: notification
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể cập nhật trạng thái thông báo."
        }));
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const payload = await Notification.markAllAsRead(req.user.id);
        return res.json(withCommonResponseAliases({
            message: "Đã đánh dấu tất cả thông báo là đã đọc.",
            ...payload
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể cập nhật trạng thái thông báo."
        }));
    }
};
