const Payment = require("../models/paymentModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { attachCheckoutUrl, buildCheckoutUrl } = require("../utils/paymentHelpers");
const { createForRoles, createForUser } = require("../services/notificationService");
const zaloPayService = require("../services/zaloPayService");

function handleError(res, error) {
    return res.status(error.statusCode || 500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

exports.getByToken = async (req, res) => {
    try {
        const payment = await Payment.getByToken(req.params.token);
        return res.json(attachCheckoutUrl(req, payment));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.confirm = async (req, res) => {
    try {
        const payment = attachCheckoutUrl(req, await Payment.confirmPayment(req.params.token));

        const orderUserId = payment.order?.user_id || payment.order?.ma_nguoi_dung;
        if (orderUserId) {
            await createForUser(orderUserId, {
                type: "payment",
                title: "Thanh toán thành công",
                message: `Đơn hàng ${payment.order?.order_code || payment.order?.ma_don_hang} đã được thanh toán thành công.`,
                metadata: {
                    order_id: payment.order?.id,
                    payment_code: payment.payment_code,
                    status: payment.status
                }
            });
        }

        await createForRoles(["admin", "staff"], {
            type: "payment",
            title: "Có đơn hàng đã thanh toán",
            message: `Thanh toán ${payment.payment_code} đã được xác nhận thành công.`,
            metadata: {
                order_id: payment.order?.id,
                payment_code: payment.payment_code,
                status: payment.status
            }
        });

        return res.json(withCommonResponseAliases({
            message: "Thanh toán online thành công.",
            payment,
            thanh_toan: payment
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.cancel = async (req, res) => {
    try {
        const payment = attachCheckoutUrl(req, await Payment.cancelPayment(req.params.token));

        const orderUserId = payment.order?.user_id || payment.order?.ma_nguoi_dung;
        if (orderUserId) {
            await createForUser(orderUserId, {
                type: "payment",
                title: "Thanh toán đã bị hủy",
                message: `Phiên thanh toán ${payment.payment_code} đã bị hủy.`,
                metadata: {
                    order_id: payment.order?.id,
                    payment_code: payment.payment_code,
                    status: payment.status
                }
            });
        }

        return res.json(withCommonResponseAliases({
            message: "Đã hủy phiên thanh toán online.",
            payment,
            thanh_toan: payment
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.zaloPayCallback = async (req, res) => {
    try {
        const { data, mac } = req.body || {};
        if (!data || !mac || !zaloPayService.verifyCallback(data, mac)) {
            return res.json({
                return_code: 2,
                return_message: "Invalid"
            });
        }

        const callbackData = JSON.parse(data);
        const payment = await Payment.confirmZaloPayPayment(callbackData.app_trans_id, callbackData);
        const orderUserId = payment.order?.user_id || payment.order?.ma_nguoi_dung;

        if (orderUserId) {
            await createForUser(orderUserId, {
                type: "payment",
                title: "Thanh toán ZaloPay thành công",
                message: `Đơn hàng ${payment.order?.order_code || payment.order?.ma_don_hang} đã được thanh toán qua ZaloPay.`,
                metadata: {
                    order_id: payment.order?.id,
                    payment_code: payment.payment_code,
                    gateway: payment.gateway,
                    status: payment.status
                }
            });
        }

        await createForRoles(["admin", "staff"], {
            type: "payment",
            title: "Có đơn hàng đã thanh toán qua ZaloPay",
            message: `Thanh toán ${payment.payment_code} đã được ZaloPay xác nhận thành công.`,
            metadata: {
                order_id: payment.order?.id,
                payment_code: payment.payment_code,
                gateway: payment.gateway,
                status: payment.status
            }
        });

        return res.json({
            return_code: 1,
            return_message: "Success"
        });
    } catch (error) {
        console.error("ZaloPay callback error:", error.message || error);
        return res.json({
            return_code: 2,
            return_message: "Invalid"
        });
    }
};

exports.zaloPayReturn = async (req, res) => {
    return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kết quả thanh toán ZaloPay</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; background: #f6fbf2; color: #162016; }
.box { max-width: 520px; margin: 48px auto; background: white; border-radius: 18px; padding: 24px; box-shadow: 0 12px 36px rgba(0,0,0,.08); }
h1 { font-size: 22px; margin: 0 0 10px; }
p { line-height: 1.5; color: #425142; }
</style>
</head>
<body>
<div class="box">
<h1>Đã quay lại Garden Fresh</h1>
<p>Nếu bạn đã thanh toán thành công, đơn hàng sẽ được cập nhật sau khi ZaloPay gửi xác nhận về hệ thống.</p>
<p>Bạn có thể đóng trang này và quay lại ứng dụng để xem trạng thái đơn hàng.</p>
</div>
</body>
</html>`);
};

exports.renderCheckoutPage = async (req, res) => {
    try {
        const payment = attachCheckoutUrl(req, await Payment.getByToken(req.params.token));
        const order = payment.order || {};
        const confirmUrl = `/payments/${req.params.token}/confirm`;
        const cancelUrl = `/payments/${req.params.token}/cancel`;

        return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Thanh toán online Garden Fresh</title>
<style>
body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #fff8ef, #f2f8ff); color: #222; margin: 0; }
.container { max-width: 620px; margin: 40px auto; background: #fff; border-radius: 20px; box-shadow: 0 18px 60px rgba(0,0,0,0.08); padding: 28px; }
.badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #eef6ff; color: #0c4a6e; font-size: 13px; margin-bottom: 14px; }
h1 { margin: 0 0 10px; font-size: 28px; }
.grid { display: grid; gap: 12px; margin: 20px 0; }
.card { background: #f8fafc; border-radius: 14px; padding: 14px 16px; }
.label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
.value { font-size: 16px; font-weight: 600; }
.actions { display: flex; gap: 12px; margin-top: 22px; }
button { border: 0; border-radius: 12px; padding: 14px 18px; font-size: 15px; font-weight: 600; cursor: pointer; }
.primary { background: #0f766e; color: #fff; }
.secondary { background: #e2e8f0; color: #1e293b; }
#result { margin-top: 18px; padding: 14px; border-radius: 12px; background: #f8fafc; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="container">
<span class="badge">Cổng thanh toán giả lập</span>
<h1>Thanh toán đơn hàng Garden Fresh</h1>
<p>Trang này dùng để mô phỏng thanh toán online trong quá trình làm đồ án và test API.</p>
<div class="grid">
<div class="card"><div class="label">Mã thanh toán</div><div class="value">${escapeHtml(payment.payment_code)}</div></div>
<div class="card"><div class="label">Mã đơn hàng</div><div class="value">${escapeHtml(order.order_code || order.ma_don_hang)}</div></div>
<div class="card"><div class="label">Người nhận</div><div class="value">${escapeHtml(order.customer_name || order.ten_nguoi_nhan)}</div></div>
<div class="card"><div class="label">Số tiền</div><div class="value">${escapeHtml(payment.amount)} VND</div></div>
<div class="card"><div class="label">Trạng thái hiện tại</div><div class="value">${escapeHtml(payment.status_label)}</div></div>
<div class="card"><div class="label">Hết hạn lúc</div><div class="value">${escapeHtml(payment.expired_at)}</div></div>
</div>
<div class="actions">
<button class="primary" onclick="submitAction('${confirmUrl}')">Xác nhận đã thanh toán</button>
<button class="secondary" onclick="submitAction('${cancelUrl}')">Hủy thanh toán</button>
</div>
<div id="result">Link thanh toán: ${escapeHtml(buildCheckoutUrl(req, req.params.token))}</div>
</div>
<script>
async function submitAction(url) {
    const result = document.getElementById('result');
    result.textContent = 'Đang xử lý...';
    try {
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        result.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        result.textContent = error.message || 'Có lỗi xảy ra khi xử lý thanh toán.';
    }
}
</script>
</body>
</html>`);
    } catch (error) {
        return res.status(error.statusCode || 500).send(`<h1>Lỗi thanh toán</h1><p>${escapeHtml(error.message || "Không thể mở trang thanh toán")}</p>`);
    }
};
