const { addVietnameseAliases } = require("./vietnameseLabels");

function buildCheckoutUrl(req, checkoutToken) {
    return `${req.protocol}://${req.get("host")}/payments/checkout/${checkoutToken}`;
}

function attachCheckoutUrl(req, payment) {
    if (!payment || !payment.checkout_token) {
        return payment;
    }

    const checkoutUrl = buildCheckoutUrl(req, payment.checkout_token);

    return addVietnameseAliases({
        ...payment,
        checkout_url: checkoutUrl
    }, {
        checkout_url: "duong_dan_thanh_toan"
    });
}

module.exports = {
    buildCheckoutUrl,
    attachCheckoutUrl
};