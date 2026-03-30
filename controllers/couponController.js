const Coupon = require("../models/couponModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Mã giảm giá đã tồn tại."
        }));
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json(withCommonResponseAliases({
            message: error.message
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getAll = async (req, res) => {
    try {
        const coupons = await Coupon.getAll(req.query);
        return res.json(coupons);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getById = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã bản ghi mã giảm giá không hợp lệ."
            }));
        }

        const coupon = await Coupon.getById(id);

        if (!coupon) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy mã giảm giá."
            }));
        }

        return res.json(coupon);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getByCode = async (req, res) => {
    try {
        const coupon = await Coupon.getByCode(req.params.code);

        if (!coupon) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy mã giảm giá."
            }));
        }

        return res.json(coupon);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.validate = async (req, res) => {
    try {
        const { code, subtotal } = req.body;

        if (!code) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập mã giảm giá cần kiểm tra."
            }));
        }

        const result = await Coupon.validateCoupon({ code, subtotal });
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.create = async (req, res) => {
    try {
        const { code, discount_type, discount_value } = req.body;

        if (!code || !discount_type || discount_value === undefined) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập đầy đủ mã giảm giá, loại giảm giá và giá trị giảm."
            }));
        }

        const coupon = await Coupon.create(req.body);
        return res.status(201).json(coupon);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã bản ghi mã giảm giá không hợp lệ."
            }));
        }

        const coupon = await Coupon.update(id, req.body);

        if (!coupon) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy mã giảm giá."
            }));
        }

        return res.json(coupon);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.remove = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã bản ghi mã giảm giá không hợp lệ."
            }));
        }

        const deleted = await Coupon.remove(id);

        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy mã giảm giá."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa mã giảm giá thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};