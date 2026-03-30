const { Op, fn, col, literal } = require("sequelize");
const { User, Product, Order, ChatConversation, ProductReview, Notification } = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

function localizeOrder(order) {
    if (!order) return null;

    const localized = addVietnameseLabels(order, {
        status: "order_status",
        payment_status: "payment_status"
    });

    return addVietnameseAliases(localized, {
        order_code: "ma_don_hang",
        customer_name: "ten_nguoi_nhan",
        total_amount: "tong_tien",
        status: "trang_thai_don_hang_ma",
        status_label: "trang_thai_don_hang_hien_thi",
        payment_status: "trang_thai_thanh_toan_ma",
        payment_status_label: "trang_thai_thanh_toan_hien_thi",
        created_at: "ngay_tao"
    });
}

function localizeTopProduct(product) {
    if (!product) return null;

    return addVietnameseAliases(product, {
        name: "ten_san_pham",
        sku: "ma_sku",
        sold_quantity: "so_luong_da_ban",
        average_rating: "diem_danh_gia_trung_binh",
        review_count: "tong_so_danh_gia"
    });
}

const DashboardModel = {
    async getAdminOverview(actor) {
        const [
            totalUsers,
            totalCustomers,
            totalProducts,
            activeProducts,
            lowStockProducts,
            totalOrders,
            pendingOrders,
            openChats,
            totalReviews,
            totalRevenue,
            unreadNotifications,
            averageRatingRow,
            recentOrders,
            topProducts,
            orderStatusRows
        ] = await Promise.all([
            User.count(),
            User.count({ where: { role: "customer" } }),
            Product.count(),
            Product.count({ where: { status: "active" } }),
            Product.count({ where: { status: "active", stock_quantity: { [Op.lte]: 10 } } }),
            Order.count(),
            Order.count({ where: { status: { [Op.in]: ["pending", "confirmed", "preparing"] } } }),
            ChatConversation.count({ where: { status: "open" } }),
            ProductReview.count(),
            Order.sum("total_amount", { where: { payment_status: "paid" } }),
            Notification.count({ where: { user_id: actor.id, is_read: false } }),
            ProductReview.findOne({
                attributes: [
                    [fn("COUNT", col("id")), "review_count"],
                    [fn("AVG", col("rating")), "average_rating"]
                ],
                raw: true
            }),
            Order.findAll({
                attributes: ["id", "order_code", "customer_name", "total_amount", "status", "payment_status", "created_at"],
                order: [["created_at", "DESC"]],
                limit: 5,
                raw: true
            }),
            Product.findAll({
                attributes: [
                    "id",
                    "name",
                    "sku",
                    [literal("(SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.product_id = Product.id)"), "sold_quantity"],
                    [literal("(SELECT COALESCE(AVG(pr.rating), 0) FROM product_reviews pr WHERE pr.product_id = Product.id)"), "average_rating"],
                    [literal("(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)"), "review_count"]
                ],
                order: [[literal("sold_quantity"), "DESC"], [literal("average_rating"), "DESC"], ["created_at", "DESC"]],
                limit: 5,
                raw: true
            }),
            Order.findAll({
                attributes: ["status", [fn("COUNT", col("id")), "total"]],
                group: ["status"],
                raw: true
            })
        ]);

        const revenue = Number(totalRevenue || 0);
        const averageRating = Number(averageRatingRow?.average_rating || 0);

        return {
            summary: addVietnameseAliases({
                total_users: totalUsers,
                total_customers: totalCustomers,
                total_products: totalProducts,
                active_products: activeProducts,
                low_stock_products: lowStockProducts,
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                open_chats: openChats,
                total_reviews: totalReviews,
                average_rating: Number(averageRating.toFixed(2)),
                total_revenue: Number(revenue.toFixed(2)),
                unread_notifications: unreadNotifications
            }, {
                total_users: "tong_nguoi_dung",
                total_customers: "tong_khach_hang",
                total_products: "tong_san_pham",
                active_products: "tong_san_pham_dang_ban",
                low_stock_products: "tong_san_pham_sap_het",
                total_orders: "tong_don_hang",
                pending_orders: "tong_don_can_xu_ly",
                open_chats: "tong_hoi_thoai_dang_mo",
                total_reviews: "tong_danh_gia",
                average_rating: "diem_danh_gia_trung_binh",
                total_revenue: "tong_doanh_thu",
                unread_notifications: "tong_thong_bao_chua_doc"
            }),
            recent_orders: recentOrders.map(localizeOrder),
            don_hang_gan_day: recentOrders.map(localizeOrder),
            top_products: topProducts.map(localizeTopProduct),
            san_pham_noi_bat: topProducts.map(localizeTopProduct),
            orders_by_status: orderStatusRows.map((item) => addVietnameseAliases(addVietnameseLabels(item, {
                status: "order_status"
            }), {
                status: "trang_thai_ma",
                status_label: "trang_thai_hien_thi",
                total: "tong_so"
            }))
        };
    }
};

module.exports = DashboardModel;
