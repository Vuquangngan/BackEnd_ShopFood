const { Op } = require("sequelize");
const UserModel = require("../models/userModel");
const {
    sequelize,
    User,
    StaffShiftSlot,
    StaffShiftAssignment,
    StaffShiftHoliday
} = require("../models");
const {
    sendShiftRegistrationEmail,
    sendWeeklyShiftScheduleEmail
} = require("../services/emailService");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const DEFAULT_SHIFT_SLOTS = [
    { client_id: "morning", name: "Ca sáng", start_time: "06:00", end_time: "12:00", tone: "morning", enabled: true },
    { client_id: "afternoon", name: "Ca chiều", start_time: "12:00", end_time: "18:00", tone: "afternoon", enabled: true },
    { client_id: "evening", name: "Ca tối", start_time: "18:00", end_time: "22:00", tone: "evening", enabled: false }
];

function normalizeDateKey(value) {
    const normalized = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00+07:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function getWeekDates(weekStart) {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function normalizeBranchId(value) {
    return String(value || "").trim();
}

function serializeSlot(slot) {
    return {
        id: slot.client_id,
        name: slot.name,
        start: slot.start_time,
        end: slot.end_time,
        tone: slot.tone,
        enabled: slot.enabled !== false,
        appliesToDate: slot.applies_to_date || ""
    };
}

function serializeAssignment(assignment) {
    const employee = assignment.employee;
    return {
        userId: Number(assignment.employee_id),
        status: assignment.status,
        source: assignment.source || "self",
        registeredAt: assignment.registered_at,
        confirmedAt: assignment.confirmed_at,
        confirmedBy: assignment.confirmed_by,
        confirmationSource: assignment.confirmation_source || "",
        user: employee ? {
            id: employee.id,
            username: employee.username,
            email: employee.email,
            phone: employee.phone,
            role: employee.role
        } : null
    };
}

async function ensureDefaultSlots(branchId, userId = null) {
    const count = await StaffShiftSlot.count({ where: { branch_id: branchId } });
    if (count > 0) return;

    await StaffShiftSlot.bulkCreate(DEFAULT_SHIFT_SLOTS.map((slot) => ({
        ...slot,
        branch_id: branchId,
        created_by: userId || null
    })));
}

async function findSlot(branchId, clientId) {
    return StaffShiftSlot.findOne({
        where: {
            branch_id: branchId,
            client_id: String(clientId || "").trim()
        }
    });
}

async function buildSchedulePayload(branchId, weekStart, userId = null) {
    await ensureDefaultSlots(branchId, userId);

    const weekDates = getWeekDates(weekStart);
    const weekEnd = weekDates[6];
    const slots = await StaffShiftSlot.findAll({
        where: {
            branch_id: branchId,
            [Op.or]: [
                { applies_to_date: null },
                { applies_to_date: { [Op.between]: [weekStart, weekEnd] } }
            ]
        },
        order: [["start_time", "ASC"], ["id", "ASC"]]
    });

    const assignments = await StaffShiftAssignment.findAll({
        where: {
            branch_id: branchId,
            shift_date: { [Op.between]: [weekStart, weekEnd] }
        },
        include: [
            { model: StaffShiftSlot, as: "slot", required: true },
            {
                model: User,
                as: "employee",
                attributes: ["id", "username", "email", "phone", "role"]
            }
        ],
        order: [["shift_date", "ASC"], ["id", "ASC"]]
    });

    const assignmentMap = {};
    assignments.forEach((assignment) => {
        const slotClientId = assignment.slot?.client_id;
        if (!slotClientId) return;
        const key = `${branchId}|${assignment.shift_date}|${slotClientId}`;
        assignmentMap[key] = assignmentMap[key] || [];
        assignmentMap[key].push(serializeAssignment(assignment));
    });

    const holidays = await StaffShiftHoliday.findAll({
        where: {
            branch_id: branchId,
            holiday_date: { [Op.between]: [weekStart, weekEnd] }
        },
        order: [["holiday_date", "ASC"]]
    });

    return {
        branch_id: branchId,
        week_start: weekStart,
        shifts: slots.map(serializeSlot),
        assignments: assignmentMap,
        holidays: holidays.map((holiday) => holiday.holiday_date)
    };
}

exports.getSchedule = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.query.branch_id);
        const weekStart = normalizeDateKey(req.query.week_start);

        if (!branchId || !weekStart) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu chi nhánh hoặc tuần cần xem lịch ca."
            }));
        }

        const payload = await buildSchedulePayload(branchId, weekStart, req.user?.id);
        return res.json(withCommonResponseAliases(payload));
    } catch (error) {
        return next(error);
    }
};

exports.saveSlot = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.body.branch_id);
        const clientId = String(req.params.id || req.body.id || `shift-${Date.now()}`).trim();
        const name = String(req.body.name || "").trim();
        const startTime = String(req.body.start || req.body.start_time || "").trim();
        const endTime = String(req.body.end || req.body.end_time || "").trim();
        const tone = ["morning", "afternoon", "evening"].includes(req.body.tone) ? req.body.tone : "morning";
        const appliesToDate = normalizeDateKey(req.body.applies_to_date || req.body.appliesToDate) || null;

        if (!branchId || !clientId || !name || !startTime || !endTime) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin ca làm việc."
            }));
        }

        const [slot] = await StaffShiftSlot.findOrCreate({
            where: { branch_id: branchId, client_id: clientId },
            defaults: {
                branch_id: branchId,
                client_id: clientId,
                name,
                start_time: startTime,
                end_time: endTime,
                tone,
                enabled: req.body.enabled !== false,
                applies_to_date: appliesToDate,
                created_by: req.user?.id || null
            }
        });

        await slot.update({
            name,
            start_time: startTime,
            end_time: endTime,
            tone,
            enabled: req.body.enabled !== false,
            applies_to_date: appliesToDate
        });

        return res.json(withCommonResponseAliases({
            message: "Đã lưu ca làm việc.",
            shift: serializeSlot(slot)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.deleteSlot = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.query.branch_id || req.body.branch_id);
        const clientId = String(req.params.id || "").trim();

        if (!branchId || !clientId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin ca cần xóa."
            }));
        }

        const slot = await findSlot(branchId, clientId);
        if (!slot) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy ca làm việc."
            }));
        }

        await slot.destroy();
        return res.json(withCommonResponseAliases({
            message: "Đã xóa ca làm việc."
        }));
    } catch (error) {
        return next(error);
    }
};

exports.replaceAssignments = async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
        const branchId = normalizeBranchId(req.body.branch_id);
        const shiftId = String(req.body.shift_id || "").trim();
        const dateKey = normalizeDateKey(req.body.date || req.body.shift_date);
        const employeeIds = Array.isArray(req.body.employee_ids)
            ? [...new Set(req.body.employee_ids.map((value) => Number(value)).filter(Boolean))]
            : [];

        if (!branchId || !shiftId || !dateKey) {
            await transaction.rollback();
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin phân công ca."
            }));
        }

        if (employeeIds.length > 3) {
            await transaction.rollback();
            return res.status(400).json(withCommonResponseAliases({
                message: "Mỗi ca chỉ được tối đa 3 nhân viên."
            }));
        }

        const slot = await findSlot(branchId, shiftId);
        if (!slot) {
            await transaction.rollback();
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy ca làm việc."
            }));
        }

        const currentRows = await StaffShiftAssignment.findAll({
            where: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey
            },
            transaction
        });
        const currentByEmployee = new Map(currentRows.map((row) => [Number(row.employee_id), row]));

        await StaffShiftAssignment.destroy({
            where: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey,
                employee_id: { [Op.notIn]: employeeIds.length ? employeeIds : [0] }
            },
            transaction
        });

        for (const employeeId of employeeIds) {
            const existing = currentByEmployee.get(employeeId);
            if (existing) continue;
            await StaffShiftAssignment.create({
                branch_id: branchId,
                shift_slot_id: slot.id,
                employee_id: employeeId,
                shift_date: dateKey,
                status: "pending",
                source: "manager",
                registered_by: req.user?.id || null,
                registered_at: new Date()
            }, { transaction });
        }

        await transaction.commit();
        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật nhân sự trong ca."
        }));
    } catch (error) {
        await transaction.rollback();
        return next(error);
    }
};

exports.selfRegister = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.body.branch_id);
        const shiftId = String(req.body.shift_id || "").trim();
        const dateKey = normalizeDateKey(req.body.date || req.body.shift_date);
        const employeeId = Number(req.user?.id || 0);

        if (!branchId || !shiftId || !dateKey || !employeeId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin đăng ký ca."
            }));
        }

        const slot = await findSlot(branchId, shiftId);
        if (!slot) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy ca làm việc."
            }));
        }

        const count = await StaffShiftAssignment.count({
            where: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey
            }
        });
        if (count >= 3) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Ca này đã đủ tối đa 3 nhân viên."
            }));
        }

        const [assignment, created] = await StaffShiftAssignment.findOrCreate({
            where: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey,
                employee_id: employeeId
            },
            defaults: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey,
                employee_id: employeeId,
                status: "pending",
                source: "self",
                registered_by: employeeId,
                registered_at: new Date()
            }
        });

        if (!created) {
            return res.status(409).json(withCommonResponseAliases({
                message: "Bạn đã đăng ký ca này rồi.",
                assignment: serializeAssignment(assignment)
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đã đăng ký ca làm việc. Chờ quản lý xác nhận.",
            assignment: serializeAssignment(assignment)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.confirmAssignments = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.body.branch_id);
        const shiftId = String(req.body.shift_id || "").trim();
        const dateKey = normalizeDateKey(req.body.date || req.body.shift_date);
        const employeeIds = Array.isArray(req.body.employee_ids)
            ? req.body.employee_ids.map((value) => Number(value)).filter(Boolean)
            : [];
        const confirmationSource = String(req.body.confirmation_source || "slot").trim();

        if (!branchId || !dateKey) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin ca cần xác nhận."
            }));
        }

        const where = {
            branch_id: branchId,
            shift_date: dateKey,
            status: "pending"
        };

        if (shiftId) {
            const slot = await findSlot(branchId, shiftId);
            if (!slot) {
                return res.status(404).json(withCommonResponseAliases({
                    message: "Không tìm thấy ca làm việc."
                }));
            }
            where.shift_slot_id = slot.id;
        }

        if (employeeIds.length) {
            where.employee_id = { [Op.in]: employeeIds };
        }

        const [updatedCount] = await StaffShiftAssignment.update({
            status: "confirmed",
            confirmed_by: req.user?.id || null,
            confirmed_at: new Date(),
            confirmation_source: confirmationSource
        }, { where });

        return res.json(withCommonResponseAliases({
            message: `Đã xác nhận ${updatedCount} lượt đăng ký ca.`,
            updated_count: updatedCount
        }));
    } catch (error) {
        return next(error);
    }
};

exports.removeAssignment = async (req, res, next) => {
    try {
        const branchId = normalizeBranchId(req.query.branch_id);
        const shiftId = String(req.query.shift_id || "").trim();
        const dateKey = normalizeDateKey(req.query.date || req.query.shift_date);
        const employeeId = Number(req.query.employee_id || 0);

        if (!branchId || !shiftId || !dateKey || !employeeId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin nhân sự cần gỡ khỏi ca."
            }));
        }

        const slot = await findSlot(branchId, shiftId);
        if (!slot) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy ca làm việc."
            }));
        }

        const deletedCount = await StaffShiftAssignment.destroy({
            where: {
                branch_id: branchId,
                shift_slot_id: slot.id,
                shift_date: dateKey,
                employee_id: employeeId
            }
        });

        return res.json(withCommonResponseAliases({
            message: deletedCount ? "Đã gỡ nhân sự khỏi ca." : "Không có phân công cần gỡ."
        }));
    } catch (error) {
        return next(error);
    }
};

exports.saveHolidays = async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
        const branchId = normalizeBranchId(req.body.branch_id);
        const weekDates = Array.isArray(req.body.week_dates)
            ? req.body.week_dates.map(normalizeDateKey).filter(Boolean)
            : [];
        const selectedDates = Array.isArray(req.body.dates)
            ? [...new Set(req.body.dates.map(normalizeDateKey).filter(Boolean))]
            : [];

        if (!branchId || !weekDates.length) {
            await transaction.rollback();
            return res.status(400).json(withCommonResponseAliases({
                message: "Thiếu thông tin ngày nghỉ lễ."
            }));
        }

        await StaffShiftHoliday.destroy({
            where: {
                branch_id: branchId,
                holiday_date: { [Op.in]: weekDates }
            },
            transaction
        });

        if (selectedDates.length) {
            await StaffShiftHoliday.bulkCreate(selectedDates.map((dateKey) => ({
                branch_id: branchId,
                holiday_date: dateKey
            })), { transaction });
        }

        await transaction.commit();
        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật ngày nghỉ lễ.",
            holidays: selectedDates
        }));
    } catch (error) {
        await transaction.rollback();
        return next(error);
    }
};

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
    const users = await Promise.all([...groupedSchedules.keys()].map((id) => UserModel.getProfile(id)));
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

    const users = await Promise.all(employeeIds.map((id) => UserModel.getProfile(id)));
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
