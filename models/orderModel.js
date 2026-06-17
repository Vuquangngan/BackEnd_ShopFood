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
const { applyPromotionsToProducts, getEffectiveUnitPrice } = require("../services/promotionPricingService");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

const SHIPPING_MARK_DELIVERED_DELAY_MS = 2 * 60 * 1000;
const RETURN_MANUAL_COMPLETE_DELAY_MS = 1 * 60 * 1000;
const RETURN_REQUEST_WINDOW_MS = 72 * 60 * 60 * 1000;
const GRAB_DEV_PROVIDER = "grab_dev";
const GRAB_DEV_STATUS_FLOW = ["driver_assigned", "delivering", "delivered"];
const NON_CANCELABLE_SHIPPING_STATUSES = new Set(["picked_up", "delivering", "delivered"]);
const ORDER_TABLE_ALIAS = "\"Order\"";

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

function buildGrabDevTrackingCode(orderId) {
    const timestamp = Date.now().toString().slice(-8);
    return `GRAB-${String(orderId || 0).padStart(5, "0")}-${timestamp}`;
}

function getGrabDevStatusLabel(status) {
    return ({
        booking: "Đang đặt tài xế",
        driver_assigned: "Đã có tài xế",
        picked_up: "Đang giao bằng Grab",
        delivering: "Đang giao bằng Grab",
        delivered: "Grab đã giao tới khách",
        cancelled: "Đã hủy vận đơn"
    })[status] || status || null;
}

function canCancelOrder(order) {
    if (!order || ["completed", "cancelled"].includes(order.status) || order.return_status) {
        return false;
    }

    if (NON_CANCELABLE_SHIPPING_STATUSES.has(order.shipping_status)) {
        return false;
    }

    return true;
}

function getStockPerSaleUnit(product) {
    const normalized = Number(product?.stock_per_sale_unit || 1);
    return Number.isFinite(normalized) && normalized > 0 ? Number(normalized.toFixed(3)) : 1;
}

function getAvailableSaleQuantity(product) {
    const stockQuantity = Number(product?.stock_quantity || 0);
    const stockPerSaleUnit = getStockPerSaleUnit(product);
    if (stockQuantity <= 0 || stockPerSaleUnit <= 0) {
        return 0;
    }

    return Math.floor((stockQuantity + Number.EPSILON) / stockPerSaleUnit);
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

    const withImage = {
        ...item,
        product_image: item.product ? item.product.thumbnail_url : (item.product_image || null)
    };

    return addVietnameseAliases(withImage, {
        product_id: "ma_san_pham",
        product_name: "ten_san_pham",
        product_image: "anh_san_pham",
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
        payment_method: "payment_method",
        refund_status: "refund_status",
        shipping_status: "shipping_status"
    });
    localized.return_status_label = getReturnStatusLabel(localized.return_status);
    localized.shipping_provider_label = localized.shipping_provider === GRAB_DEV_PROVIDER
        ? "GrabExpress"
        : (localized.shipping_provider || null);
    localized.shipping_status_label = localized.shipping_status_label || getGrabDevStatusLabel(localized.shipping_status);

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
            return_status: "trang_thai_hoan_hang_ma",
            return_status_label: "trang_thai_hoan_hang_hien_thi",
            refund_status: "trang_thai_hoan_tien_ma",
            refund_status_label: "trang_thai_hoan_tien_hien_thi",
            refund_amount: "so_tien_hoan",
            refund_reason: "ly_do_hoan_tien",
            refunded_at: "thoi_gian_hoan_tien",
            shipped_at: "thoi_gian_bat_dau_giao",
            delivered_at: "thoi_gian_giao_cho_khach",
            completed_at: "thoi_gian_giao_thanh_cong",
            customer_received_at: "thoi_gian_khach_xac_nhan_nhan_hang",
            shipping_provider: "don_vi_giao_hang",
            shipping_provider_label: "don_vi_giao_hang_hien_thi",
            tracking_code: "ma_van_don",
            shipping_status: "trang_thai_van_chuyen_ma",
            shipping_status_label: "trang_thai_van_chuyen_hien_thi",
            shipping_note: "ghi_chu_van_chuyen",
            shipping_estimated_minutes: "thoi_gian_giao_du_kien_phut",
            return_started_at: "thoi_gian_bat_dau_hoan_hang",
            return_completed_at: "thoi_gian_hoan_hang_thanh_cong",
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

function getReturnStatusLabel(value) {
    return ({
        shipping_back: "Đang hoàn hàng",
        returned: "Hàng hoàn"
    })[value] || value || null;
}

function canManuallyMarkDelivered(order) {
    if (!order || order.status !== "shipping" || !order.shipped_at) {
        return false;
    }

    const shippedAt = new Date(order.shipped_at);
    if (Number.isNaN(shippedAt.getTime())) {
        return false;
    }

    return Date.now() - shippedAt.getTime() >= SHIPPING_MARK_DELIVERED_DELAY_MS;
}

function canManuallyMarkReturnCompleted(order) {
    if (!order || order.return_status !== "shipping_back" || !order.return_started_at) {
        return false;
    }

    const startedAt = new Date(order.return_started_at);
    if (Number.isNaN(startedAt.getTime())) {
        return false;
    }

    return Date.now() - startedAt.getTime() >= RETURN_MANUAL_COMPLETE_DELAY_MS;
}

function resolveReturnRequestBaseTime(order) {
    const value = order?.customer_received_at || order?.completed_at || order?.delivered_at;
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function canCustomerRequestReturn(order) {
    if (!order || order.return_status) {
        return false;
    }

    const normalizedStatus = String(order.status || "").trim().toLowerCase();
    if (!["shipping", "completed"].includes(normalizedStatus)) {
        return false;
    }

    const baseDate = resolveReturnRequestBaseTime(order);
    if (!baseDate) {
        return false;
    }

    return Date.now() <= baseDate.getTime() + RETURN_REQUEST_WINDOW_MS;
}

function hasCollectedPayment(order) {
    if (!order) return false;
    if (order.payment_status === "paid" || order.payment_status === "refunded") return true;
    return order.payment_method === "cod" && Boolean(order.delivered_at || order.completed_at || order.customer_received_at);
}

function normalizeRefundAmount(order, value) {
    const maxAmount = Number(order?.total_amount || 0);
    const amount = Number(value || maxAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw createOrderError("Số tiền hoàn không hợp lệ.");
    }
    if (maxAmount > 0 && amount > maxAmount) {
        throw createOrderError("Số tiền hoàn không được lớn hơn tổng tiền đơn hàng.");
    }
    return Number(amount.toFixed(2));
}

async function autoCompleteExpiredShippingOrders(transaction = undefined) {
    return transaction;
}

const OrderModel = {
    async getAll(filters = {}) {
        await autoCompleteExpiredShippingOrders();
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

        if (filters.order_code) {
            where.order_code = {
                [Op.like]: `%${String(filters.order_code).trim()}%`
            };
        }

        const orders = await Order.findAll({
            where,
            attributes: {
                include: [
                    [literal(`(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = ${ORDER_TABLE_ALIAS}.id)`), "item_count"]
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
                    order: [["id", "ASC"]],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["id", "thumbnail_url"]
                        }
                    ]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        return orders.map((entity) => localizeOrder(toPlainOrder(entity)));
    },

    async getById(id) {
        await autoCompleteExpiredShippingOrders();
        const order = await Order.findByPk(id, {
            attributes: {
                include: [
                    [literal(`(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = ${ORDER_TABLE_ALIAS}.id)`), "item_count"]
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
                    order: [["id", "ASC"]],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["id", "thumbnail_url"]
                        }
                    ]
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

            const promotedProducts = await applyPromotionsToProducts(products, { transaction });
            const productMap = new Map(products.map((product) => [product.id, product]));
            const pricedProductMap = new Map(promotedProducts.map((product) => [product.id, product]));
            const orderItems = normalizedItems.map((item) => {
                const product = productMap.get(item.product_id);
                const pricedProduct = pricedProductMap.get(item.product_id) || product;

                if (!product || !product.is_published || product.status !== "active") {
                    throw createOrderError(`San pham co ma ${item.product_id} hien khong duoc mo ban.`);
                }

                if (getAvailableSaleQuantity(product) < item.quantity) {
                    throw createOrderError(`San pham ${product.name} khong du so luong ton kho.`);
                }

                const unitPrice = getEffectiveUnitPrice(pricedProduct);
                const lineTotal = unitPrice * item.quantity;

                return {
                    product_id: product.id,
                    category_id: product.category_id,
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
                items: orderItems,
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
                const stockDelta = Number((item.quantity * getStockPerSaleUnit(product)).toFixed(3));
                const nextStock = Number(product.stock_quantity) - stockDelta;
                const nextState = InventoryModel.buildNextProductState(product, nextStock);

                await product.update(nextState, { transaction });
                product.stock_quantity = nextState.stock_quantity;
                product.status = nextState.status;

                await InventoryModel.recordSaleTransaction({
                    product,
                    quantity: stockDelta,
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
        await autoCompleteExpiredShippingOrders();
        const order = await Order.findByPk(id);

        if (!order) return null;

        const updateData = {};
        const action = String(data.action || "").trim();

        ["status", "payment_status", "note"].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (!Object.keys(updateData).length && !action) {
            return this.getById(id);
        }

        if (updateData.status === "cancelled" && !canCancelOrder(order.get({ plain: true }))) {
            throw createOrderError("Không thể hủy đơn sau khi tài xế đã lấy hàng.");
        }

        if (action === "confirm_received") {
            const canConfirmReceived = Boolean(order.delivered_at) || NON_CANCELABLE_SHIPPING_STATUSES.has(order.shipping_status);
            if (order.status !== "shipping" || !canConfirmReceived || order.return_status || order.customer_received_at) {
                throw createOrderError("Đơn hàng hiện không thể xác nhận đã nhận.");
            }
            updateData.status = "completed";
            updateData.customer_received_at = new Date();
            updateData.delivered_at = order.delivered_at || updateData.customer_received_at;
            updateData.completed_at = updateData.customer_received_at;
        }

        if (action === "mark_delivered") {
            const currentOrder = order.get({ plain: true });
            if (currentOrder.return_status || currentOrder.delivered_at || !canManuallyMarkDelivered(currentOrder)) {
                throw createOrderError("Đơn hàng đang giao cần tối thiểu 2 phút trước khi xác nhận đã giao cho khách.");
            }
            updateData.delivered_at = new Date();
            updateData.completed_at = null;
        }

        if (action === "request_return") {
            const currentOrder = order.get({ plain: true });
            if (!canCustomerRequestReturn(currentOrder)) {
                throw createOrderError("Đơn hàng hiện không thể yêu cầu hoàn trả trong lúc này.");
            }
            updateData.status = "shipping";
            updateData.return_status = "shipping_back";
            updateData.refund_status = "requested";
            updateData.refund_amount = 0;
            updateData.refund_reason = data.refund_reason || data.note || null;
            updateData.refunded_at = null;
            updateData.return_started_at = new Date();
            updateData.return_completed_at = null;
            updateData.customer_received_at = null;
            updateData.shipped_at = order.shipped_at || new Date();
            updateData.delivered_at = order.delivered_at || new Date();
            updateData.completed_at = null;
        }

        if (action === "mark_returned") {
            const currentOrder = order.get({ plain: true });
            if (!canManuallyMarkReturnCompleted(currentOrder)) {
                throw createOrderError("Đơn hoàn cần tối thiểu 1 phút trước khi xác nhận đã trả về.");
            }
            updateData.status = "completed";
            updateData.return_status = "returned";
            updateData.return_completed_at = new Date();
            updateData.completed_at = updateData.return_completed_at;
        }

        if (action === "approve_refund") {
            const currentOrder = order.get({ plain: true });
            if (!currentOrder.return_status && !currentOrder.refund_status) {
                throw createOrderError("Đơn hàng chưa có yêu cầu hoàn tiền.");
            }
            if (!hasCollectedPayment(currentOrder)) {
                throw createOrderError("Đơn hàng chưa ghi nhận thanh toán nên không thể hoàn tiền.");
            }
            updateData.refund_status = "refunded";
            updateData.refund_amount = normalizeRefundAmount(currentOrder, data.refund_amount);
            updateData.refund_reason = data.refund_reason || data.note || currentOrder.refund_reason || null;
            updateData.refunded_at = new Date();
            updateData.payment_status = "refunded";
        }

        if (action === "reject_refund") {
            if (!order.return_status && !order.refund_status) {
                throw createOrderError("Đơn hàng chưa có yêu cầu hoàn tiền.");
            }
            updateData.refund_status = "rejected";
            updateData.refund_reason = data.refund_reason || data.note || order.refund_reason || null;
            updateData.refunded_at = null;
        }

        if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
            const nextStatus = updateData.status;
            const currentStatus = order.status;

            if (nextStatus === "shipping" && currentStatus !== "shipping" && action !== "request_return") {
                updateData.shipped_at = new Date();
                updateData.delivered_at = null;
                updateData.completed_at = null;
            } else if (nextStatus === "completed" && currentStatus === "shipping") {
                if (!action) {
                    throw createOrderError("Đơn đang giao chỉ chuyển hoàn thành khi khách xác nhận đã nhận hàng.");
                }
                updateData.shipped_at = order.shipped_at || new Date();
            } else if (nextStatus === "completed") {
                updateData.completed_at = new Date();
            } else if (nextStatus !== "shipping") {
                updateData.completed_at = null;
            }
        }

        await order.update(updateData);
        return this.getById(id);
    },

    async createGrabDevShipment(id, data = {}) {
        await autoCompleteExpiredShippingOrders();
        const order = await Order.findByPk(id);

        if (!order) return null;

        if (["completed", "cancelled"].includes(order.status) || order.return_status) {
            throw createOrderError("Đơn hàng hiện không thể tạo vận đơn Grab.");
        }

        if (order.tracking_code && order.shipping_provider === GRAB_DEV_PROVIDER && order.shipping_status !== "cancelled") {
            return this.getById(id);
        }

        const estimatedMinutes = Number(data.estimated_minutes || data.shipping_estimated_minutes || 45);
        const safeEstimatedMinutes = Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
            ? Math.min(Math.round(estimatedMinutes), 240)
            : 45;

        await order.update({
            status: "shipping",
            shipped_at: order.shipped_at || new Date(),
            delivered_at: null,
            completed_at: null,
            shipping_provider: GRAB_DEV_PROVIDER,
            tracking_code: buildGrabDevTrackingCode(order.id),
            shipping_status: "driver_assigned",
            shipping_note: data.note || "GrabExpress đã nhận đơn.",
            shipping_estimated_minutes: safeEstimatedMinutes
        });

        return this.getById(id);
    },

    async advanceGrabDevShipment(id, action = "next") {
        await autoCompleteExpiredShippingOrders();
        const order = await Order.findByPk(id);

        if (!order) return null;

        if (order.shipping_provider !== GRAB_DEV_PROVIDER || !order.tracking_code) {
            throw createOrderError("Đơn hàng chưa có vận đơn Grab.");
        }

        const normalizedAction = String(action || "next").trim().toLowerCase();
        if (normalizedAction === "cancel") {
            if (["delivered", "cancelled"].includes(order.shipping_status)) {
                throw createOrderError("Vận đơn Grab hiện không thể hủy.");
            }

            if (NON_CANCELABLE_SHIPPING_STATUSES.has(order.shipping_status)) {
                throw createOrderError("Không thể hủy vận đơn sau khi tài xế đã lấy hàng.");
            }

            await order.update({
                shipping_status: "cancelled",
                shipping_note: "Vận đơn Grab đã bị hủy.",
                status: order.status === "shipping" ? "preparing" : order.status,
                delivered_at: null,
                completed_at: null
            });

            return this.getById(id);
        }

        const normalizedShippingStatus = order.shipping_status === "picked_up" ? "delivering" : order.shipping_status;
        const currentIndex = GRAB_DEV_STATUS_FLOW.indexOf(normalizedShippingStatus);
        const nextStatus = GRAB_DEV_STATUS_FLOW[Math.min(
            currentIndex === -1 ? 0 : currentIndex + 1,
            GRAB_DEV_STATUS_FLOW.length - 1
        )];
        const updateData = {
            shipping_status: nextStatus,
            shipping_note: `GrabExpress: ${getGrabDevStatusLabel(nextStatus)}.`
        };

        if (nextStatus === "delivered") {
            updateData.delivered_at = new Date();
            updateData.completed_at = null;
            updateData.status = "shipping";
        } else {
            updateData.status = "shipping";
            updateData.shipped_at = order.shipped_at || new Date();
            updateData.delivered_at = null;
            updateData.completed_at = null;
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
