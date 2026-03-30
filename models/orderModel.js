const { Op, literal } = require("sequelize");
const {
    sequelize,
    Cart,
    CartItem,
    Coupon,
    Order,
    OrderItem,
    Product,
    User
} = require("./index");
const CouponModel = require("./couponModel");
const InventoryModel = require("./inventoryModel");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

function createOrderError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function buildOrderCode() {
    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `ORD-${timestamp}-${randomNumber}`;
}

async function getNormalizedItemsFromActiveCart(userId, transaction) {
    const cart = await Cart.findOne({
        where: {
            user_id: userId,
            status: "active"
        },
        include: [
            {
                model: CartItem,
                as: "items"
            }
        ],
        transaction
    });

    if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
        return [];
    }

    return cart.items.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity)
    }));
}

async function clearActiveCart(userId, transaction) {
    if (!userId) return;

    const cart = await Cart.findOne({
        where: {
            user_id: userId,
            status: "active"
        },
        transaction
    });

    if (!cart) return;

    await CartItem.destroy({
        where: { cart_id: cart.id },
        transaction
    });

    await cart.update({ status: "converted" }, { transaction });
}

function localizeUser(user) {
    if (!user) return null;

    return addVietnameseAliases(user, {
        username: "ten_nguoi_dung"
    });
}

function localizeCoupon(coupon) {
    if (!coupon) return null;

    return addVietnameseAliases(coupon, {
        code: "ma_giam_gia"
    });
}

function localizeOrderItem(item) {
    if (!item) return null;

    return addVietnameseAliases(item, {
        product_id: "ma_san_pham",
        product_name: "ten_san_pham",
        unit_price: "don_gia",
        quantity: "so_luong",
        line_total: "thanh_tien",
        created_at: "ngay_tao"
    });
}

function toPlainOrder(orderInstance) {
    if (!orderInstance) return null;

    const order = orderInstance.get({ plain: true });

    return {
        ...order,
        item_count: Number(order.item_count || 0),
        username: order.user ? order.user.username : null,
        coupon_code: order.coupon ? order.coupon.code : null
    };
}

function localizeOrder(order) {
    if (!order) return null;

    const localized = addVietnameseLabels(order, {
        status: "order_status",
        payment_status: "payment_status",
        payment_method: "payment_method"
    });

    const user = localizeUser(localized.user);
    const coupon = localizeCoupon(localized.coupon);
    const items = (localized.items || []).map(localizeOrderItem);

    return {
        ...addVietnameseAliases(localized, {
            order_code: "ma_don_hang",
            user_id: "ma_nguoi_dung",
            coupon_id: "ma_phieu_giam_gia",
            customer_name: "ten_nguoi_nhan",
            customer_phone: "so_dien_thoai_nguoi_nhan",
            shipping_address: "dia_chi_giao_hang",
            ward: "phuong_xa",
            district: "quan_huyen",
            city: "tinh_thanh",
            note: "ghi_chu",
            payment_method: "phuong_thuc_thanh_toan_ma",
            payment_method_label: "phuong_thuc_thanh_toan_hien_thi",
            payment_status: "trang_thai_thanh_toan_ma",
            payment_status_label: "trang_thai_thanh_toan_hien_thi",
            status: "trang_thai_don_hang_ma",
            status_label: "trang_thai_don_hang_hien_thi",
            subtotal: "tam_tinh",
            shipping_fee: "phi_van_chuyen",
            discount_amount: "so_tien_giam",
            total_amount: "tong_tien",
            item_count: "tong_so_san_pham",
            username: "ten_nguoi_dung",
            coupon_code: "ma_giam_gia",
            user: "nguoi_dung",
            coupon: "phieu_giam_gia",
            items: "danh_sach_san_pham",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        user,
        nguoi_dung: user,
        coupon,
        phieu_giam_gia: coupon,
        items,
        danh_sach_san_pham: items
    };
}

const OrderModel = {
    async getAll(filters = {}) {
        const where = {};

        if (filters.user_id) {
            where.user_id = Number(filters.user_id);
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.payment_status) {
            where.payment_status = filters.payment_status;
        }

        const orders = await Order.findAll({
            where,
            attributes: {
                include: [
                    [literal("(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = Order.id)"), "item_count"]
                ]
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "username"]
                },
                {
                    model: Coupon,
                    as: "coupon",
                    attributes: ["id", "code"]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        return orders.map((entity) => localizeOrder(toPlainOrder(entity)));
    },

    async getById(id) {
        const order = await Order.findByPk(id, {
            attributes: {
                include: [
                    [literal("(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = Order.id)"), "item_count"]
                ]
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "username"]
                },
                {
                    model: Coupon,
                    as: "coupon",
                    attributes: ["id", "code"]
                },
                {
                    model: OrderItem,
                    as: "items",
                    separate: true,
                    order: [["id", "ASC"]]
                }
            ]
        });

        return localizeOrder(toPlainOrder(order));
    },

    async create(data) {
        let normalizedItems = Array.isArray(data.items)
            ? data.items
                .map((item) => ({
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity)
                }))
                .filter((item) => item.product_id && item.quantity > 0)
            : [];

        if (!normalizedItems.length && data.use_cart === true && data.user_id) {
            normalizedItems = await getNormalizedItemsFromActiveCart(data.user_id);
        }

        if (!normalizedItems.length) {
            throw createOrderError("Don hang phai co it nhat mot san pham.");
        }

        let orderId;

        await sequelize.transaction(async (transaction) => {
            const productIds = [...new Set(normalizedItems.map((item) => item.product_id))];
            const products = await Product.findAll({
                where: {
                    id: { [Op.in]: productIds }
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (products.length !== productIds.length) {
                throw createOrderError("Co san pham khong ton tai trong he thong.");
            }

            const productMap = new Map(products.map((product) => [product.id, product]));
            const orderItems = normalizedItems.map((item) => {
                const product = productMap.get(item.product_id);

                if (!product || !product.is_published || product.status !== "active") {
                    throw createOrderError(`San pham co ma ${item.product_id} hien khong duoc mo ban.`);
                }

                if (Number(product.stock_quantity) < item.quantity) {
                    throw createOrderError(`San pham ${product.name} khong du so luong ton kho.`);
                }

                const unitPrice = Number(product.sale_price || product.price);
                const lineTotal = unitPrice * item.quantity;

                return {
                    product_id: product.id,
                    product_name: product.name,
                    unit_price: unitPrice,
                    quantity: item.quantity,
                    line_total: Number(lineTotal.toFixed(2))
                };
            });

            const subtotal = Number(orderItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
            const shippingFee = Number(data.shipping_fee || 0);
            const { coupon, discountAmount } = await CouponModel.resolveCouponForOrder({
                couponId: data.coupon_id,
                couponCode: data.coupon_code,
                subtotal,
                transaction
            });
            const totalAmount = Number(Math.max(subtotal + shippingFee - discountAmount, 0).toFixed(2));

            const order = await Order.create({
                order_code: buildOrderCode(),
                user_id: data.user_id || null,
                coupon_id: coupon ? coupon.id : null,
                customer_name: data.customer_name,
                customer_phone: data.customer_phone,
                shipping_address: data.shipping_address,
                ward: data.ward || null,
                district: data.district || null,
                city: data.city,
                note: data.note || null,
                payment_method: data.payment_method || "cod",
                payment_status: data.payment_status || "unpaid",
                status: data.status || "pending",
                subtotal,
                shipping_fee: shippingFee,
                discount_amount: discountAmount,
                total_amount: totalAmount
            }, { transaction });

            orderId = order.id;

            await OrderItem.bulkCreate(
                orderItems.map((item) => ({
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    unit_price: item.unit_price,
                    quantity: item.quantity,
                    line_total: item.line_total
                })),
                { transaction }
            );

            for (const item of orderItems) {
                const product = productMap.get(item.product_id);
                const nextStock = Number(product.stock_quantity) - item.quantity;
                const nextState = InventoryModel.buildNextProductState(product, nextStock);

                await product.update(nextState, { transaction });
                product.stock_quantity = nextState.stock_quantity;
                product.status = nextState.status;

                await InventoryModel.recordSaleTransaction({
                    product,
                    quantity: item.quantity,
                    orderId: order.id,
                    userId: data.user_id || null,
                    note: `Xuat kho ban hang cho don ${order.order_code}`,
                    transaction
                });
            }

            if (coupon) {
                await coupon.increment("used_count", {
                    by: 1,
                    transaction
                });
            }

            if (data.clear_cart === true || data.use_cart === true) {
                await clearActiveCart(data.user_id, transaction);
            }
        });

        return this.getById(orderId);
    },

    async updateStatus(id, data) {
        const order = await Order.findByPk(id);

        if (!order) return null;

        const updateData = {};

        ["status", "payment_status", "note"].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (!Object.keys(updateData).length) {
            return this.getById(id);
        }

        await order.update(updateData);
        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await Order.destroy({
            where: { id }
        });

        return deletedRows > 0;
    }
};

module.exports = OrderModel;
