const LABEL_GROUPS = {
    user_role: {
        admin: "Quản trị viên",
        staff: "Nhân viên",
        customer: "Khách hàng"
    },
    user_status: {
        active: "Đang hoạt động",
        inactive: "Tạm ngưng",
        blocked: "Bị khóa"
    },
    product_status: {
        draft: "Bản nháp",
        active: "Đang bán",
        out_of_stock: "Hết hàng",
        archived: "Lưu trữ"
    },
    supplier_status: {
        active: "Đang hoạt động",
        inactive: "Tạm ngưng"
    },
    cart_status: {
        active: "Đang sử dụng",
        converted: "Đã chuyển thành đơn hàng",
        abandoned: "Đã bỏ giỏ hàng"
    },
    discount_type: {
        percent: "Giảm theo phần trăm",
        fixed: "Giảm số tiền cố định"
    },
    recipe_difficulty: {
        easy: "Dễ",
        medium: "Trung bình",
        hard: "Khó"
    },
    recipe_status: {
        draft: "Bản nháp",
        published: "Đã xuất bản",
        archived: "Lưu trữ"
    },
    order_status: {
        pending: "Chờ xác nhận",
        confirmed: "Đã xác nhận",
        preparing: "Đang chuẩn bị",
        shipping: "Đang giao",
        completed: "Hoàn thành",
        cancelled: "Đã hủy"
    },
    payment_status: {
        unpaid: "Chưa thanh toán",
        paid: "Đã thanh toán",
        refunded: "Đã hoàn tiền"
    },
    payment_method: {
        cod: "Thanh toán khi nhận hàng",
        bank_transfer: "Chuyển khoản",
        online: "Thanh toán trực tuyến"
    },
    inventory_document_type: {
        receipt: "Nhap kho",
        adjustment_in: "Dieu chinh tang",
        adjustment_out: "Dieu chinh giam",
        damage: "Hang hong",
        return_supplier: "Tra nha cung cap"
    },
    inventory_document_status: {
        draft: "Nháp",
        completed: "Hoàn tất",
        cancelled: "Đã hủy"
    },
    inventory_transaction_type: {
        receipt: "Nhap kho",
        sale: "Ban hang",
        adjustment_in: "Dieu chinh tang",
        adjustment_out: "Dieu chinh giam",
        damage: "Hang hong",
        return_supplier: "Tra nha cung cap"
    },
    inventory_direction: {
        in: "Nhap",
        out: "Xuat"
    },
    notification_type: {
        order_created: "Đơn hàng mới",
        order_status: "Cập nhật đơn hàng",
        payment: "Thanh toán",
        chat: "Tin nhắn mới",
        product_review: "Đánh giá sản phẩm",
        system: "Hệ thống"
    }
};

function getVietnameseLabel(group, value) {
    if (!value || !LABEL_GROUPS[group]) return null;
    return LABEL_GROUPS[group][value] || value;
}

function addVietnameseLabels(entity, fieldMap) {
    if (!entity) return entity;

    const result = { ...entity };

    Object.entries(fieldMap).forEach(([fieldName, group]) => {
        if (Object.prototype.hasOwnProperty.call(result, fieldName)) {
            result[`${fieldName}_label`] = getVietnameseLabel(group, result[fieldName]);
        }
    });

    return result;
}

function addVietnameseAliases(entity, fieldMap) {
    if (!entity || typeof entity !== "object") return entity;

    const result = { ...entity };

    Object.entries(fieldMap).forEach(([fieldName, aliasName]) => {
        if (
            Object.prototype.hasOwnProperty.call(result, fieldName) &&
            !Object.prototype.hasOwnProperty.call(result, aliasName)
        ) {
            result[aliasName] = result[fieldName];
        }
    });

    return result;
}

module.exports = {
    getVietnameseLabel,
    addVietnameseLabels,
    addVietnameseAliases
};
