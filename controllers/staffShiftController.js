const User = require("../models/userModel");
const {
    sendShiftRegistrationEmail,
    sendWeeklyShiftScheduleEmail
} = require("../services/emailService");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function normalizeScheduleItem(item = {}) {
    const employeeId = Number(item.employee_id || item.employeeId || 0);
    const shiftName = String(item.shift_name || item.shiftName || "").trim();
    const shiftDateLabel = String(item.shift_date_label || item.shiftDateLabel || item.shift_date || "").trim();
    const startTime = String(item.start_time || item.startTime || "").trim();
    const endTime = String(item.end_time || item.endTime || "").trim();

    if (!employeeId || !shiftName || !shiftDateLabel || !startTime || !endTime) return null;

    return {
        employeeId,
        shiftName,
        shiftDateLabel,
        startTime,
        endTime
    };
}

async function sendWeeklyScheduleNotifications(req, res) {
    const branchName = String(req.body.branch_name || "").trim();
    const schedules = Array.isArray(req.body.schedules)
        ? req.body.schedules.map(normalizeScheduleItem).filter(Boolean)
        : [];

    if (!branchName || !schedules.length) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Thiếu thông tin để gửi email lịch làm việc trong tuần."
        }));
    }

    const groupedSchedules = schedules.reduce((map, item) => {
        const list = map.get(item.employeeId) || [];
        list.push(item);
        map.set(item.employeeId, list);
        return map;
    }, new Map());
    const users = await Promise.all([...groupedSchedules.keys()].map((id) => User.getProfile(id)));
    const validUsers = users.filter((user) => user && user.email);

    if (!validUsers.length) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Không tìm thấy nhân viên có email hợp lệ để gửi lịch tuần."
        }));
    }

    const results = await Promise.allSettled(validUsers.map((user) => sendWeeklyShiftScheduleEmail({
        to: user.email,
        username: user.username,
        branchName,
        schedules: groupedSchedules.get(Number(user.id)) || []
    })));

    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failed = results
        .map((result, index) => ({ result, user: validUsers[index] }))
        .filter(({ result }) => result.status === "rejected")
        .map(({ result, user }) => ({
            user_id: user.id,
            email: user.email,
            error: result.reason?.message || "Không xác định"
        }));

    return res.json(withCommonResponseAliases({
        message: sentCount
            ? `Đã gửi email lịch tuần cho ${sentCount} nhân viên.`
            : "Không gửi được email lịch làm việc trong tuần.",
        sent_count: sentCount,
        failed_count: failed.length,
        failed
    }));
}

exports.sendShiftConfirmationNotifications = async (req, res) => {
    if (Array.isArray(req.body.schedules)) {
        return sendWeeklyScheduleNotifications(req, res);
    }

    const employeeIds = Array.isArray(req.body.employee_ids)
        ? [...new Set(req.body.employee_ids.map((value) => Number(value)).filter(Boolean))]
        : [];

    const branchName = String(req.body.branch_name || "").trim();
    const shiftName = String(req.body.shift_name || "").trim();
    const shiftDateLabel = String(req.body.shift_date_label || req.body.shift_date || "").trim();
    const startTime = String(req.body.start_time || "").trim();
    const endTime = String(req.body.end_time || "").trim();

    if (!employeeIds.length || !branchName || !shiftName || !shiftDateLabel || !startTime || !endTime) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Thiếu thông tin để gửi email xác nhận ca làm việc."
        }));
    }

    const users = await Promise.all(employeeIds.map((id) => User.getProfile(id)));
    const validUsers = users.filter((user) => user && user.email);

    if (!validUsers.length) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Không tìm thấy nhân viên có email hợp lệ để gửi thông báo."
        }));
    }

    const results = await Promise.allSettled(validUsers.map((user) => sendShiftRegistrationEmail({
        to: user.email,
        username: user.username,
        branchName,
        shiftName,
        shiftDateLabel,
        startTime,
        endTime
    })));

    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failed = results
        .map((result, index) => ({ result, user: validUsers[index] }))
        .filter(({ result }) => result.status === "rejected")
        .map(({ result, user }) => ({
            user_id: user.id,
            email: user.email,
            error: result.reason?.message || "Không xác định"
        }));

    return res.json(withCommonResponseAliases({
        message: sentCount
            ? `Đã gửi email xác nhận ca cho ${sentCount} nhân viên.`
            : "Không gửi được email xác nhận ca làm việc.",
        sent_count: sentCount,
        failed_count: failed.length,
        failed
    }));
};
