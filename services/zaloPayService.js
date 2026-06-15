const crypto = require("crypto");
const https = require("https");
const querystring = require("querystring");

const SANDBOX_ENDPOINT = "https://sb-openapi.zalopay.vn/v2/create";
const REAL_ENDPOINT = "https://openapi.zalopay.vn/v2/create";

function getConfig() {
    const appId = process.env.ZALOPAY_APP_ID;
    const key1 = process.env.ZALOPAY_KEY1;
    const key2 = process.env.ZALOPAY_KEY2;

    if (!appId || !key1 || !key2) {
        const error = new Error("Chưa cấu hình ZaloPay. Vui lòng bổ sung ZALOPAY_APP_ID, ZALOPAY_KEY1 và ZALOPAY_KEY2 trong file .env.");
        error.statusCode = 500;
        throw error;
    }

    return {
        appId,
        key1,
        key2,
        endpoint: process.env.ZALOPAY_ENDPOINT ||
            (process.env.ZALOPAY_ENV === "production" ? REAL_ENDPOINT : SANDBOX_ENDPOINT)
    };
}

function hmacSha256(data, key) {
    return crypto.createHmac("sha256", key).update(data).digest("hex");
}

function getVietnamDatePrefix(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const valueOf = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${valueOf("year")}${valueOf("month")}${valueOf("day")}`;
}

function buildAppTransId(order) {
    const orderPart = String(order.order_code || order.id || Date.now())
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-24);
    const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    return `${getVietnamDatePrefix()}_${orderPart}${randomPart}`.slice(0, 40);
}

function getPublicBaseUrl(req) {
    return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function buildItems(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    return items.map((item) => ({
        itemid: String(item.product_id || item.id || ""),
        itemname: item.product_name || "Sản phẩm",
        itemprice: Math.round(Number(item.unit_price || 0)),
        itemquantity: Number(item.quantity || 1)
    }));
}

function postForm(url, payload) {
    return new Promise((resolve, reject) => {
        const body = querystring.stringify(payload);
        const request = https.request(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body)
            }
        }, (response) => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error(data || error.message));
                }
            });
        });

        request.on("error", reject);
        request.write(body);
        request.end();
    });
}

async function createOrder({ order, payment, req }) {
    const config = getConfig();
    const appTransId = buildAppTransId(order);
    const appTime = Date.now();
    const amount = Math.round(Number(payment.amount || order.total_amount || 0));
    const item = JSON.stringify(buildItems(order));
    const embedData = JSON.stringify({
        merchantinfo: "shopfood",
        order_id: order.id,
        payment_id: payment.id,
        preferred_payment_method: ["zalopay_wallet"],
        redirecturl: process.env.ZALOPAY_REDIRECT_URL || `${getPublicBaseUrl(req)}/payments/zalopay/return`
    });
    const callbackUrl = `${getPublicBaseUrl(req)}/payments/zalopay/callback`;
    const appUser = String(order.user_id || order.customer_phone || "shopfood_user").slice(0, 50);

    const payload = {
        app_id: config.appId,
        app_user: appUser,
        app_time: appTime,
        amount,
        app_trans_id: appTransId,
        embed_data: embedData,
        item,
        description: `FOODIFI - Thanh toán đơn hàng #${order.order_code}`,
        bank_code: process.env.ZALOPAY_BANK_CODE || "",
        callback_url: callbackUrl,
        phone: order.customer_phone || "",
        address: [order.shipping_address, order.ward, order.district, order.city].filter(Boolean).join(", ")
    };

    const hmacInput = [
        payload.app_id,
        payload.app_trans_id,
        payload.app_user,
        payload.amount,
        payload.app_time,
        payload.embed_data,
        payload.item
    ].join("|");
    payload.mac = hmacSha256(hmacInput, config.key1);

    const response = await postForm(config.endpoint, payload);
    if (Number(response.return_code) !== 1) {
        const error = new Error(response.sub_return_message || response.return_message || "Không thể tạo đơn thanh toán ZaloPay.");
        error.statusCode = 502;
        throw error;
    }

    return {
        app_trans_id: appTransId,
        order_url: response.order_url,
        zp_trans_token: response.zp_trans_token || response.order_token || null,
        raw_response: response
    };
}

function verifyCallback(data, mac) {
    const config = getConfig();
    return hmacSha256(data, config.key2) === mac;
}

module.exports = {
    createOrder,
    verifyCallback
};
