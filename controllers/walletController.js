const { WalletTransfer, Order } = require("../models");

function createError(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

// Tính số dư = tổng hoàn tiền - tổng đã chuyển (không tính rejected)
async function computeBalance(userId) {
    const orders = await Order.findAll({ where: { user_id: userId } });
    const totalRefund = orders.reduce((sum, o) => {
        const refundStatus = (o.refund_status || "").toLowerCase();
        const paymentStatus = (o.payment_status || "").toLowerCase();
        if (refundStatus === "refunded" || paymentStatus === "refunded") {
            return sum + parseFloat(o.refund_amount > 0 ? o.refund_amount : o.total_amount);
        }
        return sum;
    }, 0);

    const transfers = await WalletTransfer.findAll({
        where: {
            user_id: userId,
            status: ["pending", "processing", "completed"]
        }
    });
    const totalTransferred = transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return Math.max(0, totalRefund - totalTransferred);
}

const WalletController = {
    async createTransfer(req, res, next) {
        try {
            const userId = req.user.id;
            const { bank_name, account_number, account_holder, amount } = req.body;

            if (!bank_name || !account_number || !account_holder || !amount) {
                throw createError("Vui lòng điền đầy đủ thông tin chuyển khoản.");
            }

            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                throw createError("Số tiền chuyển không hợp lệ.");
            }

            const currentBalance = await computeBalance(userId);
            if (amountNum > currentBalance) {
                throw createError("Số dư không đủ để thực hiện giao dịch này.");
            }

            const transfer = await WalletTransfer.create({
                user_id: userId,
                bank_name: bank_name.trim(),
                account_number: account_number.trim(),
                account_holder: account_holder.trim().toUpperCase(),
                amount: amountNum,
                status: "pending"
            });

            const newBalance = await computeBalance(userId);

            return res.status(201).json({
                transfer: transfer.get({ plain: true }),
                new_balance: newBalance
            });
        } catch (err) {
            next(err);
        }
    },

    async getBalance(req, res, next) {
        try {
            const balance = await computeBalance(req.user.id);
            return res.json({ balance });
        } catch (err) {
            next(err);
        }
    },

    async getTransfers(req, res, next) {
        try {
            const transfers = await WalletTransfer.findAll({
                where: { user_id: req.user.id },
                order: [["created_at", "DESC"]]
            });
            return res.json(transfers.map((t) => t.get({ plain: true })));
        } catch (err) {
            next(err);
        }
    }
};

module.exports = WalletController;
