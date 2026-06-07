const { Op } = require("sequelize");
const { PromotionCampaign, Product } = require("../models");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const VALID_TYPES = new Set(["discount", "buy_x_get_y"]);
const VALID_SCOPES = new Set(["products", "categories"]);
const VALID_STATUSES = new Set(["draft", "active", "paused", "expired"]);

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function parseIdList(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== "string") return ["all"];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : ["all"];
    } catch (_error) {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
}

function serializeIdList(value) {
    const list = Array.isArray(value)
        ? value.map(String).filter(Boolean)
        : parseIdList(value);
    return JSON.stringify(list.length ? list : ["all"]);
}

function plain(record) {
    return record?.get ? record.get({ plain: true }) : record;
}

function normalizeType(value) {
    if (value === "golden_hour") return "discount";
    return VALID_TYPES.has(value) ? value : "discount";
}

function normalizeStatus(body = {}) {
    if (body.is_active === false || body.is_active === "false") return "paused";
    if (body.status && VALID_STATUSES.has(body.status)) return body.status;
    return "active";
}

function normalizePayload(body = {}, user = null) {
    const type = normalizeType(String(body.type || "discount"));
    const applyScope = VALID_SCOPES.has(body.apply_scope) ? body.apply_scope : "products";

    return {
        name: String(body.name || "").trim(),
        type,
        status: normalizeStatus(body),
        is_active: body.is_active === undefined ? true : Boolean(body.is_active === true || body.is_active === "true" || body.is_active === "on"),
        apply_scope: applyScope,
        apply_product_ids: serializeIdList(body.apply_product_ids),
        gift_product_id: type === "buy_x_get_y" && body.gift_product_id ? parseId(body.gift_product_id) : null,
        discount_percent: type === "discount" ? Number(body.discount_percent || 0) : 0,
        time_range: String(body.time_range || "").trim() || null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        note: String(body.note || "").trim() || null,
        created_by: user?.id || body.created_by || null
    };
}

function mapCampaign(record) {
    const data = plain(record);
    if (!data) return null;
    const giftProduct = data.gift_product ? plain(data.gift_product) : null;
    return {
        ...data,
        apply_product_ids: parseIdList(data.apply_product_ids),
        gift_product: giftProduct
    };
}

exports.list = async (req, res, next) => {
    try {
        const where = {};
        const type = normalizeType(String(req.query.type || ""));
        const status = String(req.query.status || "").trim();
        const keyword = String(req.query.keyword || req.query.search || "").trim();
        const onlyActive = String(req.query.active || "").trim();

        if (req.query.type && VALID_TYPES.has(type)) where.type = type;
        if (status && VALID_STATUSES.has(status)) where.status = status;
        if (onlyActive === "true") where.is_active = true;
        if (keyword) where.name = { [Op.like]: `%${keyword}%` };

        const campaigns = await PromotionCampaign.findAll({
            where,
            include: [{ model: Product, as: "gift_product", required: false }],
            order: [["created_at", "DESC"]]
        });

        return res.json(withCommonResponseAliases({
            campaigns: campaigns.map(mapCampaign)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.getById = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Mã chiến dịch không hợp lệ." }));
        }

        const campaign = await PromotionCampaign.findByPk(id, {
            include: [{ model: Product, as: "gift_product", required: false }]
        });
        if (!campaign) {
            return res.status(404).json(withCommonResponseAliases({ message: "Không tìm thấy chiến dịch khuyến mãi." }));
        }

        return res.json(withCommonResponseAliases({ campaign: mapCampaign(campaign) }));
    } catch (error) {
        return next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const payload = normalizePayload(req.body, req.user);
        if (!payload.name) {
            return res.status(400).json(withCommonResponseAliases({ message: "Vui lòng nhập tên chiến dịch khuyến mãi." }));
        }

        const created = await PromotionCampaign.create(payload);
        const campaign = await PromotionCampaign.findByPk(created.id, {
            include: [{ model: Product, as: "gift_product", required: false }]
        });

        return res.status(201).json(withCommonResponseAliases({
            message: "Đã tạo chiến dịch khuyến mãi.",
            campaign: mapCampaign(campaign)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Mã chiến dịch không hợp lệ." }));
        }

        const campaign = await PromotionCampaign.findByPk(id);
        if (!campaign) {
            return res.status(404).json(withCommonResponseAliases({ message: "Không tìm thấy chiến dịch khuyến mãi." }));
        }

        const payload = normalizePayload(req.body, req.user);
        if (!payload.name) {
            return res.status(400).json(withCommonResponseAliases({ message: "Vui lòng nhập tên chiến dịch khuyến mãi." }));
        }

        await campaign.update(payload);
        const updated = await PromotionCampaign.findByPk(id, {
            include: [{ model: Product, as: "gift_product", required: false }]
        });

        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật chiến dịch khuyến mãi.",
            campaign: mapCampaign(updated)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.remove = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Mã chiến dịch không hợp lệ." }));
        }

        const deleted = await PromotionCampaign.destroy({ where: { id } });
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({ message: "Không tìm thấy chiến dịch khuyến mãi." }));
        }

        return res.json(withCommonResponseAliases({ message: "Đã xóa chiến dịch khuyến mãi." }));
    } catch (error) {
        return next(error);
    }
};
