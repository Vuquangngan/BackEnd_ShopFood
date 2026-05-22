const { Op } = require("sequelize");
const { Coupon } = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

const COUPON_FIELDS = [
    "code",
    "description",
    "campaign_metadata",
    "discount_type",
    "discount_value",
    "min_order_value",
    "max_discount_value",
    "start_date",
    "end_date",
    "usage_limit",
    "used_count",
    "is_active"
];

function createCouponError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function toPlainCoupon(couponInstance) {
    if (!couponInstance) return null;
    return couponInstance.get ? couponInstance.get({ plain: true }) : couponInstance;
}

function localizeCoupon(coupon) {
    if (!coupon) return null;

    const localized = addVietnameseLabels(coupon, {
        discount_type: "discount_type"
    });

    return addVietnameseAliases(localized, {
        code: "ma_giam_gia",
        description: "mo_ta",
        campaign_metadata: "du_lieu_chien_dich",
        discount_type: "loai_giam_gia_ma",
        discount_type_label: "loai_giam_gia_hien_thi",
        discount_value: "gia_tri_giam",
        min_order_value: "gia_tri_don_toi_thieu",
        max_discount_value: "giam_toi_da",
        start_date: "ngay_bat_dau",
        end_date: "ngay_ket_thuc",
        usage_limit: "gioi_han_luot_dung",
        used_count: "so_luot_da_dung",
        is_active: "dang_hoat_dong",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

function calculateDiscountAmount(coupon, subtotal) {
    const subtotalValue = Number(subtotal || 0);

    if (subtotalValue <= 0) return 0;

    if (coupon.discount_type === "percent") {
        let discountAmount = (subtotalValue * Number(coupon.discount_value || 0)) / 100;

        if (coupon.max_discount_value !== null && coupon.max_discount_value !== undefined) {
            discountAmount = Math.min(discountAmount, Number(coupon.max_discount_value));
        }

        return Number(discountAmount.toFixed(2));
    }

    return Number(Math.min(Number(coupon.discount_value || 0), subtotalValue).toFixed(2));
}

function parseCampaignMetadata(coupon) {
    try {
        return coupon?.campaign_metadata ? JSON.parse(coupon.campaign_metadata) : {};
    } catch (_error) {
        return {};
    }
}

function resolveApplicableSubtotal(coupon, subtotal, items = []) {
    const metadata = parseCampaignMetadata(coupon);
    const applyScope = metadata.apply_scope === "categories" ? "categories" : "products";
    const productIds = Array.isArray(metadata.applied_product_ids)
        ? metadata.applied_product_ids.map((id) => Number(id)).filter(Boolean)
        : [];
    const categoryIds = Array.isArray(metadata.applied_category_ids)
        ? metadata.applied_category_ids.map((id) => Number(id)).filter(Boolean)
        : [];

    if (
        (applyScope === "products" && !productIds.length)
        || (applyScope === "categories" && !categoryIds.length)
        || !Array.isArray(items)
        || !items.length
    ) {
        return Number(subtotal || 0);
    }

    const productIdSet = new Set(productIds);
    const categoryIdSet = new Set(categoryIds);
    const eligibleSubtotal = items.reduce((sum, item) => {
        const productId = Number(item.product_id || item.productId || item.id || 0);
        const categoryId = Number(item.category_id || item.categoryId || item.product?.category_id || item.product?.categoryId || 0);

        if (applyScope === "products" && !productIdSet.has(productId)) return sum;
        if (applyScope === "categories" && !categoryIdSet.has(categoryId)) return sum;

        const lineTotal = Number(item.line_total || item.lineTotal || 0);
        if (lineTotal > 0) return sum + lineTotal;

        return sum + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 0));
    }, 0);

    if (eligibleSubtotal <= 0) {
        throw createCouponError("Mã giảm giá không áp dụng cho sản phẩm trong đơn hàng này.");
    }

    return Number(eligibleSubtotal.toFixed(2));
}

function ensureCouponIsUsable(coupon, subtotal, context = {}) {
    if (!coupon) {
        throw createCouponError("Không tìm thấy mã giảm giá.", 404);
    }

    const now = new Date();

    if (!coupon.is_active) {
        throw createCouponError("Mã giảm giá hiện đang ngừng áp dụng.");
    }

    if (coupon.start_date && new Date(coupon.start_date) > now) {
        throw createCouponError("Mã giảm giá chưa đến thời gian áp dụng.");
    }

    if (coupon.end_date && new Date(coupon.end_date) < now) {
        throw createCouponError("Mã giảm giá đã hết hạn sử dụng.");
    }

    if (coupon.usage_limit !== null && coupon.usage_limit !== undefined) {
        if (Number(coupon.used_count) >= Number(coupon.usage_limit)) {
            throw createCouponError("Mã giảm giá đã hết lượt sử dụng.");
        }
    }

    if (coupon.min_order_value !== null && coupon.min_order_value !== undefined) {
        if (Number(subtotal || 0) < Number(coupon.min_order_value)) {
            throw createCouponError("Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã giảm giá.");
        }
    }

    const applicableSubtotal = resolveApplicableSubtotal(coupon, subtotal, context.items);
    return calculateDiscountAmount(coupon, applicableSubtotal);
}

const CouponModel = {
    async getAll(filters = {}) {
        const where = {};

        if (Object.prototype.hasOwnProperty.call(filters, "is_active")) {
            where.is_active = filters.is_active === "true" || filters.is_active === true;
        }

        if (filters.keyword) {
            where[Op.or] = [
                { code: { [Op.like]: `%${filters.keyword}%` } },
                { description: { [Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const coupons = await Coupon.findAll({
            where,
            order: [["created_at", "DESC"]]
        });

        return coupons.map((coupon) => localizeCoupon(toPlainCoupon(coupon)));
    },

    async getById(id) {
        const coupon = await Coupon.findByPk(id);
        return localizeCoupon(toPlainCoupon(coupon));
    },

    async getByCode(code) {
        const coupon = await Coupon.findOne({ where: { code } });
        return localizeCoupon(toPlainCoupon(coupon));
    },

    async create(data) {
        const coupon = await Coupon.create({
            code: data.code,
            description: data.description || null,
            campaign_metadata: data.campaign_metadata || null,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            min_order_value: data.min_order_value || null,
            max_discount_value: data.max_discount_value || null,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            usage_limit: data.usage_limit || null,
            used_count: data.used_count || 0,
            is_active: Object.prototype.hasOwnProperty.call(data, "is_active") ? Boolean(data.is_active) : true
        });

        return this.getById(coupon.id);
    },

    async update(id, data) {
        const coupon = await Coupon.findByPk(id);
        if (!coupon) return null;

        const updateData = {};

        COUPON_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (Object.keys(updateData).length) {
            await coupon.update(updateData);
        }

        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await Coupon.destroy({ where: { id } });
        return deletedRows > 0;
    },

    async validateCoupon(payload = {}) {
        const coupon = await Coupon.findOne({ where: { code: payload.code } });
        const plainCoupon = toPlainCoupon(coupon);
        const discountAmount = ensureCouponIsUsable(plainCoupon, payload.subtotal, { items: payload.items });

        return {
            coupon: localizeCoupon(plainCoupon),
            subtotal: Number(payload.subtotal || 0),
            discount_amount: discountAmount,
            so_tien_giam: discountAmount,
            final_total: Number((Number(payload.subtotal || 0) - discountAmount).toFixed(2)),
            tong_tien_sau_giam: Number((Number(payload.subtotal || 0) - discountAmount).toFixed(2))
        };
    },

    async resolveCouponForOrder({ couponId, couponCode, subtotal, items = [], transaction }) {
        if (!couponId && !couponCode) {
            return {
                coupon: null,
                discountAmount: 0
            };
        }

        const coupon = couponId
            ? await Coupon.findByPk(couponId, { transaction })
            : await Coupon.findOne({ where: { code: couponCode }, transaction });

        const plainCoupon = toPlainCoupon(coupon);
        const discountAmount = ensureCouponIsUsable(plainCoupon, subtotal, { items });

        return {
            coupon,
            discountAmount
        };
    }
};

module.exports = CouponModel;
module.exports.calculateDiscountAmount = calculateDiscountAmount;
