const Cart = require("../models/cartModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json(withCommonResponseAliases({
            message: error.message
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getMyCart = async (req, res) => {
    try {
        const cart = await Cart.getActiveCart(req.user.id);
        return res.json(cart);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.addItem = async (req, res) => {
    try {
        const cart = await Cart.addItem(req.user.id, req.body);
        return res.status(201).json(cart);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.updateItem = async (req, res) => {
    try {
        const itemId = parseId(req.params.itemId);

        if (!itemId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã mục trong giỏ hàng không hợp lệ."
            }));
        }

        const cart = await Cart.updateItem(req.user.id, itemId, req.body);

        if (!cart) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm cần cập nhật trong giỏ hàng."
            }));
        }

        return res.json(cart);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.removeItem = async (req, res) => {
    try {
        const itemId = parseId(req.params.itemId);

        if (!itemId) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã mục trong giỏ hàng không hợp lệ."
            }));
        }

        const deleted = await Cart.removeItem(req.user.id, itemId);

        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm cần xóa trong giỏ hàng."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đã xóa sản phẩm khỏi giỏ hàng."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.clearCart = async (req, res) => {
    try {
        const cart = await Cart.clearCart(req.user.id);
        return res.json(withCommonResponseAliases({
            message: "Đã làm trống giỏ hàng.",
            cart
        }));
    } catch (error) {
        return handleError(res, error);
    }
};