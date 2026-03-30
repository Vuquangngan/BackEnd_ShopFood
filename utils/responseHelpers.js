const { addVietnameseAliases } = require("./vietnameseLabels");

function withCommonResponseAliases(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return payload;
    }

    return addVietnameseAliases(payload, {
        message: "thong_bao",
        user: "nguoi_dung"
    });
}

module.exports = {
    withCommonResponseAliases
};