const Product = require("../models/productModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { createForRoles } = require("../services/notificationService");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function isManager(user) {
    return user && ["admin", "staff"].includes(user.role);
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Đường dẫn định danh hoặc mã sản phẩm đã tồn tại."
        }));
    }

    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Danh mục không tồn tại."
        }));
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json(withCommonResponseAliases({
            message: error.message
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getAll = async (req, res) => {
    try {
        const products = await Product.getAll({
            ...req.query,
            only_public: !isManager(req.user)
        });
        return res.json(products);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const product = await Product.getById(id, {
            only_public: !isManager(req.user)
        });
        if (!product) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(product);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getReviews = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const reviews = await Product.getReviews(id, req.query);
        if (!reviews) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm để xem đánh giá."
            }));
        }

        return res.json(reviews);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.submitReview = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        if (req.body.rating === undefined) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập số sao đánh giá từ 1 đến 5."
            }));
        }

        const payload = await Product.upsertReview(id, req.user.id, req.body);
        if (!payload) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm để đánh giá."
            }));
        }

        await createForRoles(["admin", "staff"], {
            type: "product_review",
            title: "Có đánh giá sản phẩm mới",
            message: `${req.user.username} vừa đánh giá sản phẩm có mã ${id}.`,
            metadata: {
                product_id: id,
                user_id: req.user.id,
                rating: Number(req.body.rating)
            }
        });

        return res.status(201).json(withCommonResponseAliases({
            message: "Gửi đánh giá sản phẩm thành công.",
            ...payload
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.create = async (req, res) => {
    try {
        const { category_id, category_slug, name, price } = req.body;

        if ((!category_id && !category_slug) || !name || price === undefined) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập category_id hoặc category_slug, cùng với tên sản phẩm và giá bán."
            }));
        }

        const product = await Product.create(req.body);
        return res.status(201).json(product);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const product = await Product.update(id, req.body);
        if (!product) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(product);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.publish = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const product = await Product.publish(id, req.body);
        if (!product) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đưa sản phẩm lên bán thành công.",
            product,
            san_pham: product
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.setStoreAllocation = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const product = await Product.setStoreAllocation(id, req.body);
        if (!product) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật phân bổ sản phẩm cho cửa hàng.",
            product,
            san_pham: product
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.unpublish = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const product = await Product.unpublish(id, req.body);
        if (!product) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Ẩn sản phẩm khỏi kênh bán thành công.",
            product,
            san_pham: product
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.remove = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã sản phẩm không hợp lệ."
            }));
        }

        const deleted = await Product.remove(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa sản phẩm thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};
