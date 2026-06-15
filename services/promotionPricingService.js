const { Op } = require("sequelize");
const { PromotionCampaign } = require("../models");

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

function isCampaignActiveAt(campaign, now = new Date()) {
    if (!campaign || campaign.is_active === false || campaign.status !== "active") return false;

    const startDate = campaign.start_date ? new Date(campaign.start_date) : null;
    const endDate = campaign.end_date ? new Date(campaign.end_date) : null;

    if (startDate && !Number.isNaN(startDate.getTime()) && startDate > now) return false;
    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) return false;

    return true;
}

function campaignAppliesToProduct(campaign, product) {
    const ids = parseIdList(campaign.apply_product_ids);
    if (ids.includes("all")) return true;

    if (campaign.apply_scope === "categories") {
        return ids.includes(String(product.category_id || product.category?.id || ""));
    }

    return ids.includes(String(product.id || ""));
}

function getCampaignRank(campaign) {
    if (campaign.type === "discount") return Number(campaign.discount_percent || 0);
    if (campaign.type === "buy_x_get_y") return 0.5;
    return 0;
}

function chooseBestCampaign(campaigns, product) {
    return campaigns
        .filter((campaign) => campaignAppliesToProduct(campaign, product))
        .sort((left, right) => getCampaignRank(right) - getCampaignRank(left))[0] || null;
}

function buildPromotionLabel(campaign) {
    if (!campaign) return null;
    if (campaign.type === "discount") {
        return `Giảm ${Number(campaign.discount_percent || 0)}%`;
    }
    if (campaign.type === "buy_x_get_y") {
        return "Mua X tặng Y";
    }
    return campaign.name || "Khuyến mãi";
}

function applyCampaignToProduct(product, campaign) {
    if (!product || !campaign) return product;

    const baseCurrentPrice = Number(product.current_price || product.sale_price || product.price || 0);
    let currentPrice = baseCurrentPrice;

    if (campaign.type === "discount") {
        const discountPercent = Math.min(Math.max(Number(campaign.discount_percent || 0), 0), 100);
        currentPrice = Number((baseCurrentPrice * (1 - discountPercent / 100)).toFixed(2));
    }

    return {
        ...product,
        current_price: currentPrice,
        promotion_label: buildPromotionLabel(campaign),
        promotion_name: campaign.name || null,
        promotion_type: campaign.type || null,
        badge_label: buildPromotionLabel(campaign),
        khuyen_mai_label: buildPromotionLabel(campaign)
    };
}

async function getActivePromotionCampaigns(options = {}) {
    const now = options.now || new Date();
    const rows = await PromotionCampaign.findAll({
        where: {
            is_active: true,
            status: "active",
            [Op.and]: [
                {
                    [Op.or]: [
                        { start_date: null },
                        { start_date: { [Op.lte]: now } }
                    ]
                },
                {
                    [Op.or]: [
                        { end_date: null },
                        { end_date: { [Op.gte]: now } }
                    ]
                }
            ]
        },
        transaction: options.transaction,
        order: [["discount_percent", "DESC"], ["created_at", "DESC"]]
    });

    return rows.map((row) => row.get ? row.get({ plain: true }) : row).filter((campaign) => isCampaignActiveAt(campaign, now));
}

async function applyPromotionsToProducts(products, options = {}) {
    const campaigns = options.campaigns || await getActivePromotionCampaigns(options);
    return products.map((product) => {
        const campaign = chooseBestCampaign(campaigns, product);
        return campaign ? applyCampaignToProduct(product, campaign) : product;
    });
}

async function applyPromotionToProduct(product, options = {}) {
    const campaigns = options.campaigns || await getActivePromotionCampaigns(options);
    const plainProduct = product?.get ? product.get({ plain: true }) : product;
    const campaign = chooseBestCampaign(campaigns, plainProduct);
    return campaign ? applyCampaignToProduct(plainProduct, campaign) : plainProduct;
}

function getEffectiveUnitPrice(product) {
    return Number(product?.current_price || product?.sale_price || product?.price || 0);
}

module.exports = {
    applyPromotionToProduct,
    applyPromotionsToProducts,
    getActivePromotionCampaigns,
    getEffectiveUnitPrice
};
