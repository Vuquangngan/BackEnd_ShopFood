const { sequelize, Cart, CartItem, Product } = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

function createCartError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getStockPerSaleUnit(product) {
    const normalized = Number(product?.stock_per_sale_unit || 1);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
}

function getAvailableSaleQuantity(product) {
    const stockQuantity = Number(product?.stock_quantity || 0);
    const stockPerSaleUnit = getStockPerSaleUnit(product);
    if (stockQuantity <= 0 || stockPerSaleUnit <= 0) {
        return 0;
    }

    return Math.floor((stockQuantity + Number.EPSILON) / stockPerSaleUnit);
}

async function getActiveCartInstance(userId, transaction) {
    let cart = await Cart.findOne({
        where: {
            user_id: userId,
            status: "active"
        },
        transaction
    });

    if (!cart) {
        cart = await Cart.create({ user_id: userId, status: "active" }, { transaction });
    }

    return cart;
}

function toPlainCart(cartInstance) {
    if (!cartInstance) return null;

    const cart = cartInstance.get ? cartInstance.get({ plain: true }) : cartInstance;
    const items = (cart.items || []).map((item) => {
        const unitPrice = Number(item.unit_price || 0);
        const quantity = Number(item.quantity || 0);
        return {
            ...item,
            line_total: Number((unitPrice * quantity).toFixed(2)),
            product_name: item.product ? item.product.name : null,
            product_slug: item.product ? item.product.slug : null,
            thumbnail_url: item.product ? item.product.thumbnail_url : null,
            product_status: item.product ? item.product.status : null,
            sale_unit: item.product ? (item.product.sale_unit || item.product.unit) : null,
            stock_unit: item.product ? item.product.stock_unit : null,
            stock_per_sale_unit: item.product ? Number(item.product.stock_per_sale_unit || 1) : 1
        };
    });

    return {
        ...cart,
        items,
        item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        subtotal: Number(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2))
    };
}

function localizeCartItem(item) {
    if (!item) return null;

    const localized = addVietnameseLabels(item, {
        product_status: "product_status"
    });

    return addVietnameseAliases(localized, {
        product_id: "ma_san_pham",
        product_name: "ten_san_pham",
        product_slug: "duong_dan_slug_san_pham",
        quantity: "so_luong",
        unit_price: "don_gia",
        line_total: "thanh_tien",
        thumbnail_url: "anh_dai_dien",
        product_status: "trang_thai_san_pham_ma",
        product_status_label: "trang_thai_san_pham_hien_thi",
        sale_unit: "don_vi_ban",
        stock_unit: "don_vi_kho",
        stock_per_sale_unit: "so_quy_doi_don_vi_ban",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

function localizeCart(cart) {
    if (!cart) return null;

    const localized = addVietnameseLabels(cart, {
        status: "cart_status"
    });

    const items = (localized.items || []).map(localizeCartItem);

    return {
        ...addVietnameseAliases(localized, {
            user_id: "ma_nguoi_dung",
            status: "trang_thai_gio_hang_ma",
            status_label: "trang_thai_gio_hang_hien_thi",
            items: "danh_sach_san_pham",
            item_count: "tong_so_luong",
            subtotal: "tam_tinh",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        items,
        danh_sach_san_pham: items
    };
}

const CartModel = {
    async getActiveCart(userId) {
        await getActiveCartInstance(userId);

        const cart = await Cart.findOne({
            where: {
                user_id: userId,
                status: "active"
            },
            include: [
                {
                    model: CartItem,
                    as: "items",
                    separate: true,
                    order: [["id", "ASC"]],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["id", "name", "slug", "thumbnail_url", "status", "unit", "sale_unit", "stock_unit", "stock_quantity", "stock_per_sale_unit"]
                        }
                    ]
                }
            ]
        });

        return localizeCart(toPlainCart(cart));
    },

    async addItem(userId, data) {
        const productId = Number(data.product_id);
        const quantity = Number(data.quantity || 1);

        if (!productId || quantity <= 0) {
            throw createCartError("Thông tin sản phẩm hoặc số lượng thêm vào giỏ hàng không hợp lệ.");
        }

        await sequelize.transaction(async (transaction) => {
            const cart = await getActiveCartInstance(userId, transaction);
            const product = await Product.findByPk(productId, { transaction });

            if (!product) {
                throw createCartError("Sản phẩm không tồn tại.", 404);
            }

            if (product.status !== "active") {
                throw createCartError("Sản phẩm hiện không thể thêm vào giỏ hàng.");
            }

            const existingItem = await CartItem.findOne({
                where: {
                    cart_id: cart.id,
                    product_id: product.id
                },
                transaction
            });

            const nextQuantity = existingItem
                ? Number(existingItem.quantity) + quantity
                : quantity;

            if (getAvailableSaleQuantity(product) < nextQuantity) {
                throw createCartError("Số lượng tồn kho không đủ để thêm vào giỏ hàng.");
            }

            const unitPrice = Number(product.sale_price || product.price);

            if (existingItem) {
                await existingItem.update({
                    quantity: nextQuantity,
                    unit_price: unitPrice
                }, { transaction });
            } else {
                await CartItem.create({
                    cart_id: cart.id,
                    product_id: product.id,
                    quantity,
                    unit_price: unitPrice
                }, { transaction });
            }
        });

        return this.getActiveCart(userId);
    },

    async updateItem(userId, itemId, data) {
        const quantity = Number(data.quantity);
        if (!Number.isInteger(quantity) || quantity < 0) {
            throw createCartError("Số lượng sản phẩm trong giỏ hàng không hợp lệ.");
        }

        const cart = await getActiveCartInstance(userId);
        const cartItem = await CartItem.findOne({
            where: {
                id: itemId,
                cart_id: cart.id
            }
        });

        if (!cartItem) return null;

        if (quantity === 0) {
            await cartItem.destroy();
            return this.getActiveCart(userId);
        }

        const product = await Product.findByPk(cartItem.product_id);
        if (!product) {
            throw createCartError("Sản phẩm không tồn tại.", 404);
        }

        if (getAvailableSaleQuantity(product) < quantity) {
            throw createCartError("Số lượng tồn kho không đủ để cập nhật giỏ hàng.");
        }

        await cartItem.update({
            quantity,
            unit_price: Number(product.sale_price || product.price)
        });

        return this.getActiveCart(userId);
    },

    async removeItem(userId, itemId) {
        const cart = await getActiveCartInstance(userId);
        const deletedRows = await CartItem.destroy({
            where: {
                id: itemId,
                cart_id: cart.id
            }
        });

        return deletedRows > 0;
    },

    async clearCart(userId) {
        const cart = await getActiveCartInstance(userId);
        await CartItem.destroy({
            where: {
                cart_id: cart.id
            }
        });

        return this.getActiveCart(userId);
    }
};

module.exports = CartModel;
