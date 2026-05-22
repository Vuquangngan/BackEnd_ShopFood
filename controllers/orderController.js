const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { attachCheckoutUrl } = require("../utils/paymentHelpers");
const { createForRoles, createForUser } = require("../services/notificationService");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function isManager(role) {
    return role === "admin" || role === "staff";
}

function canCustomerRequestReturn(order) {
    if (!order || order.return_status) {
        return false;
    }

    const normalizedStatus = String(order.status || "").trim().toLowerCase();
    if (!["shipping", "completed"].includes(normalizedStatus)) {
        return false;
    }

    const baseDate =
        order.customer_received_at ||
        order.completed_at ||
        order.delivered_at;

    if (!baseDate) {
        return false;
    }

    const baseMillis = new Date(baseDate).getTime();
    if (Number.isNaN(baseMillis)) {
        return false;
    }

    return Date.now() <= baseMillis + 72 * 60 * 60 * 1000;
}

function handleError(res, error) {
    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Người dùng hoặc mã giảm giá liên kết không tồn tại."
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
        const orders = await Order.getAll(req.query);
        return res.json(orders);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getMine = async (req, res) => {
    try {
        const orders = await Order.getAll({
            ...req.query,
            user_id: req.user.id
        });

        return res.json(orders);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const order = await Order.getById(id);
        if (!order) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đơn hàng."
            }));
        }

        if (!isManager(req.user.role) && Number(order.user_id) !== Number(req.user.id)) {
            return res.status(403).json(withCommonResponseAliases({
                message: "Bạn không có quyền xem đơn hàng này."
            }));
        }

        return res.json(order);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.create = async (req, res) => {
    try {
        const { customer_name, customer_phone, shipping_address, city, items, use_cart } = req.body;

        if (!customer_name || !customer_phone || !shipping_address || !city) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập đầy đủ họ tên người nhận, số điện thoại, địa chỉ giao hàng và tỉnh/thành phố."
            }));
        }

        if ((!Array.isArray(items) || !items.length) && use_cart !== true) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng thêm ít nhất một sản phẩm vào danh sách đặt hàng hoặc chọn tạo đơn từ giỏ hàng."
            }));
        }

        const payload = {
            ...req.body,
            user_id: isManager(req.user.role) ? (req.body.user_id || req.user.id) : req.user.id
        };

        const order = await Order.create(payload);

        if (order.user_id) {
            await createForUser(order.user_id, {
                type: "order_created",
                title: "Đã tạo đơn hàng mới",
                message: `Đơn hàng ${order.order_code} của bạn đã được tạo thành công.`,
                metadata: {
                    order_id: order.id,
                    order_code: order.order_code,
                    total_amount: order.total_amount
                }
            });
        }

        await createForRoles(["admin", "staff"], {
            type: "order_created",
            title: "Có đơn hàng mới cần xử lý",
            message: `Đơn hàng ${order.order_code} vừa được tạo và cần xác nhận.`,
            metadata: {
                order_id: order.id,
                order_code: order.order_code,
                total_amount: order.total_amount
            }
        });

        if (order.payment_method === "online") {
            const payment = attachCheckoutUrl(req, await Payment.createOrReuseCheckout(order.id, req.user, req));
            return res.status(201).json({
                ...order,
                online_payment: payment,
                thanh_toan_truc_tuyen: payment
            });
        }

        return res.status(201).json(order);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.createPaymentLink = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const payment = attachCheckoutUrl(req, await Payment.createOrReuseCheckout(id, req.user, req));
        return res.status(201).json(withCommonResponseAliases({
            message: "Tạo link thanh toán online thành công.",
            payment,
            thanh_toan: payment
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getPayments = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const payments = (await Payment.getPaymentsForOrder(id, req.user)).map((payment) => attachCheckoutUrl(req, payment));
        return res.json(payments);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const currentOrder = await Order.getById(id);
        if (!currentOrder) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đơn hàng."
            }));
        }

        if (!isManager(req.user.role)) {
            if (Number(currentOrder.user_id) !== Number(req.user.id)) {
                return res.status(403).json(withCommonResponseAliases({
                    message: "Bạn không có quyền cập nhật đơn hàng này."
                }));
            }

            const nextStatus = String(req.body.status || "").trim();
            const action = String(req.body.action || "").trim();
            const canCancelOwnOrder =
                nextStatus === "cancelled" &&
                !["completed", "cancelled"].includes(currentOrder.status) &&
                !currentOrder.return_status &&
                !["picked_up", "delivering", "delivered"].includes(currentOrder.shipping_status);
            const canConfirmOwnCompletedOrder =
                currentOrder.status === "shipping" &&
                !!currentOrder.delivered_at &&
                !currentOrder.return_status &&
                !currentOrder.customer_received_at &&
                action === "confirm_received";
            const canRequestReturnOrder =
                action === "request_return" &&
                canCustomerRequestReturn(currentOrder);

            if (!canCancelOwnOrder && !canConfirmOwnCompletedOrder && !canRequestReturnOrder) {
                return res.status(403).json(withCommonResponseAliases({
                    message: "Bạn chỉ có thể hủy đơn trước khi tài xế lấy hàng, xác nhận đã nhận hàng hoặc yêu cầu hoàn trả đơn trong vòng 72 giờ sau khi giao."
                }));
            }
        }

        const requestedAction = String(req.body.action || "").trim();
        const order = await Order.updateStatus(id, req.body);

        if (order.user_id) {
            if (requestedAction === "approve_refund") {
                await createForUser(order.user_id, {
                    type: "wallet_refund",
                    title: "Đã hoàn tiền vào ví",
                    message: `Đơn hàng ${order.order_code} đã được hoàn ${Number(order.refund_amount || 0).toLocaleString("vi-VN")}đ vào ví của bạn.`,
                    metadata: {
                        order_id: order.id,
                        order_code: order.order_code,
                        status: order.status,
                        refund_status: order.refund_status,
                        refund_amount: order.refund_amount,
                        refunded_at: order.refunded_at
                    }
                });
            } else if (requestedAction === "reject_refund") {
                await createForUser(order.user_id, {
                    type: "refund_rejected",
                    title: "Yêu cầu hoàn tiền bị từ chối",
                    message: `Đơn hàng ${order.order_code} chưa được duyệt hoàn tiền.${order.refund_reason ? ` Lý do: ${order.refund_reason}` : ""}`,
                    metadata: {
                        order_id: order.id,
                        order_code: order.order_code,
                        status: order.status,
                        refund_status: order.refund_status,
                        refund_reason: order.refund_reason
                    }
                });
            } else {
                await createForUser(order.user_id, {
                    type: "order_status",
                    title: "Đơn hàng đã được cập nhật",
                    message: `Đơn hàng ${order.order_code} hiện ở trạng thái ${order.status_label || order.status}.`,
                    metadata: {
                        order_id: order.id,
                        order_code: order.order_code,
                        status: order.status
                    }
                });
            }
        }

        return res.json(order);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.createGrabDevShipment = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const order = await Order.createGrabDevShipment(id, req.body || {});
        if (!order) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đơn hàng."
            }));
        }

        if (order.user_id) {
            await createForUser(order.user_id, {
                type: "order_status",
                title: "Đơn hàng đã được bàn giao Grab",
                message: `Đơn hàng ${order.order_code} đã tạo vận đơn GrabExpress ${order.tracking_code}.`,
                metadata: {
                    order_id: order.id,
                    order_code: order.order_code,
                    tracking_code: order.tracking_code,
                    shipping_provider: order.shipping_provider
                }
            });
        }

        return res.status(201).json(order);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.updateGrabDevShipment = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const order = await Order.advanceGrabDevShipment(id, req.body?.action || "next");
        if (!order) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đơn hàng."
            }));
        }

        if (order.user_id) {
            await createForUser(order.user_id, {
                type: "order_status",
                title: "Cập nhật giao hàng Grab",
                message: `Vận đơn ${order.tracking_code} hiện ở trạng thái ${order.shipping_status_label || order.shipping_status}.`,
                metadata: {
                    order_id: order.id,
                    order_code: order.order_code,
                    tracking_code: order.tracking_code,
                    shipping_status: order.shipping_status
                }
            });
        }

        return res.json(order);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.remove = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã đơn hàng không hợp lệ."
            }));
        }

        const deleted = await Order.remove(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đơn hàng."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa đơn hàng thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};
