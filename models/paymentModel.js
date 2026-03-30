const { randomUUID } = require("crypto");
const { Op } = require("sequelize");

const { Order, PaymentTransaction } = require("./index");
const { addVietnameseAliases } = require("../utils/vietnameseLabels");

const PAYMENT_STATUS_LABELS = {
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    failed: "Thanh toán thất bại",
    cancelled: "Đã hủy thanh toán",
    expired: "Hết hạn thanh toán"
};

function createPaymentError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function buildPaymentCode() {
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `PAY-${timestamp}-${randomPart}`;
}

function isManager(role) {
    return role === "admin" || role === "staff";
}

function toPlain(instance) {
    if (!instance) return null;
    return instance.get ? instance.get({ plain: true }) : instance;
}

function localizeOrderSummary(order) {
    if (!order) return null;

    return addVietnameseAliases({
        id: order.id,
        user_id: order.user_id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        status: order.status
    }, {
        user_id: "ma_nguoi_dung",
        order_code: "ma_don_hang",
        customer_name: "ten_nguoi_nhan",
        total_amount: "tong_tien",
        payment_method: "phuong_thuc_thanh_toan_ma",
        payment_status: "trang_thai_thanh_toan_ma",
        status: "trang_thai_don_hang_ma"
    });
}

function localizePayment(payment) {
    if (!payment) return null;

    const plainPayment = toPlain(payment);
    const order = plainPayment.order ? localizeOrderSummary(plainPayment.order) : null;

    const localized = addVietnameseAliases({
        ...plainPayment,
        status_label: PAYMENT_STATUS_LABELS[plainPayment.status] || plainPayment.status,
        order
    }, {
        order_id: "ma_don_hang",
        payment_code: "ma_thanh_toan",
        gateway: "cong_thanh_toan",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi",
        amount: "so_tien",
        checkout_token: "ma_phien_thanh_toan",
        paid_at: "thoi_gian_thanh_toan",
        expired_at: "thoi_gian_het_han",
        failure_reason: "ly_do_that_bai",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat",
        order: "don_hang"
    });

    return {
        ...localized,
        order,
        don_hang: order
    };
}

async function getAccessibleOrder(orderId, actor) {
    const order = await Order.findByPk(orderId);

    if (!order) {
        throw createPaymentError("Không tìm thấy đơn hàng.", 404);
    }

    if (!isManager(actor.role) && Number(order.user_id) !== Number(actor.id)) {
        throw createPaymentError("Bạn không có quyền thao tác với đơn hàng này.", 403);
    }

    return order;
}

async function expirePendingPayments(orderId) {
    await PaymentTransaction.update({
        status: "expired",
        failure_reason: "Phiên thanh toán đã hết hạn."
    }, {
        where: {
            order_id: orderId,
            status: "pending",
            expired_at: { [Op.lt]: new Date() }
        }
    });
}

const PaymentModel = {
    async createOrReuseCheckout(orderId, actor) {
        const order = await getAccessibleOrder(orderId, actor);

        if (order.payment_method !== "online") {
            throw createPaymentError("Đơn hàng này chưa chọn phương thức thanh toán online.");
        }

        if (order.payment_status === "paid") {
            throw createPaymentError("Đơn hàng này đã được thanh toán online.");
        }

        if (order.status === "cancelled") {
            throw createPaymentError("Không thể tạo thanh toán cho đơn hàng đã hủy.");
        }

        await expirePendingPayments(order.id);

        let payment = await PaymentTransaction.findOne({
            where: {
                order_id: order.id,
                status: "pending",
                expired_at: { [Op.gt]: new Date() }
            },
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: Order,
                    as: "order"
                }
            ]
        });

        if (!payment) {
            payment = await PaymentTransaction.create({
                order_id: order.id,
                payment_code: buildPaymentCode(),
                gateway: "mock_gateway",
                status: "pending",
                amount: order.total_amount,
                checkout_token: randomUUID(),
                expired_at: new Date(Date.now() + 30 * 60 * 1000)
            });

            payment = await PaymentTransaction.findByPk(payment.id, {
                include: [{ model: Order, as: "order" }]
            });
        }

        return localizePayment(payment);
    },

    async getPaymentsForOrder(orderId, actor) {
        await getAccessibleOrder(orderId, actor);

        const payments = await PaymentTransaction.findAll({
            where: { order_id: orderId },
            include: [{ model: Order, as: "order" }],
            order: [["created_at", "DESC"]]
        });

        return payments.map(localizePayment);
    },

    async getByToken(checkoutToken) {
        const payment = await PaymentTransaction.findOne({
            where: { checkout_token: checkoutToken },
            include: [{ model: Order, as: "order" }]
        });

        if (!payment) {
            throw createPaymentError("Không tìm thấy phiên thanh toán.", 404);
        }

        if (payment.status === "pending" && payment.expired_at && new Date(payment.expired_at) < new Date()) {
            await payment.update({
                status: "expired",
                failure_reason: "Phiên thanh toán đã hết hạn."
            });
        }

        const refreshedPayment = await PaymentTransaction.findByPk(payment.id, {
            include: [{ model: Order, as: "order" }]
        });

        return localizePayment(refreshedPayment);
    },

    async confirmPayment(checkoutToken) {
        const payment = await PaymentTransaction.findOne({
            where: { checkout_token: checkoutToken },
            include: [{ model: Order, as: "order" }]
        });

        if (!payment) {
            throw createPaymentError("Không tìm thấy phiên thanh toán.", 404);
        }

        if (payment.status === "paid") {
            return localizePayment(payment);
        }

        if (payment.status !== "pending") {
            throw createPaymentError("Phiên thanh toán này không thể xác nhận nữa.");
        }

        if (payment.expired_at && new Date(payment.expired_at) < new Date()) {
            await payment.update({
                status: "expired",
                failure_reason: "Phiên thanh toán đã hết hạn."
            });
            throw createPaymentError("Phiên thanh toán đã hết hạn.");
        }

        await payment.update({
            status: "paid",
            paid_at: new Date(),
            failure_reason: null
        });

        await payment.order.update({ payment_status: "paid" });

        const refreshedPayment = await PaymentTransaction.findByPk(payment.id, {
            include: [{ model: Order, as: "order" }]
        });

        return localizePayment(refreshedPayment);
    },

    async cancelPayment(checkoutToken) {
        const payment = await PaymentTransaction.findOne({
            where: { checkout_token: checkoutToken },
            include: [{ model: Order, as: "order" }]
        });

        if (!payment) {
            throw createPaymentError("Không tìm thấy phiên thanh toán.", 404);
        }

        if (payment.status === "cancelled") {
            return localizePayment(payment);
        }

        if (payment.status === "paid") {
            throw createPaymentError("Phiên thanh toán đã thành công, không thể hủy.");
        }

        await payment.update({
            status: "cancelled",
            failure_reason: "Người dùng đã hủy thanh toán."
        });

        const refreshedPayment = await PaymentTransaction.findByPk(payment.id, {
            include: [{ model: Order, as: "order" }]
        });

        return localizePayment(refreshedPayment);
    }
};

module.exports = PaymentModel;
