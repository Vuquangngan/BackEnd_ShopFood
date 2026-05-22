const Recipe = require("../models/recipeModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Đường dẫn định danh của công thức đã tồn tại."
        }));
    }

    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Danh mục công thức, người dùng hoặc sản phẩm liên kết không tồn tại."
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
        const recipes = await Recipe.getAll(req.query);
        return res.json(recipes);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã công thức không hợp lệ."
            }));
        }

        const recipe = await Recipe.getById(id);
        if (!recipe) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy công thức."
            }));
        }

        return res.json(recipe);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.create = async (req, res) => {
    try {
        const { title, slug } = req.body;

        if (!title || !slug) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập tên công thức và đường dẫn định danh (slug)."
            }));
        }

        const payload = {
            ...req.body,
            author_id: req.user ? req.user.id : req.body.author_id
        };

        const recipe = await Recipe.create(payload);
        return res.status(201).json(recipe);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã công thức không hợp lệ."
            }));
        }

        const recipe = await Recipe.update(id, req.body);
        if (!recipe) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy công thức."
            }));
        }

        return res.json(recipe);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.toggleFavorite = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã công thức không hợp lệ."
            }));
        }

        const recipe = await Recipe.toggleFavorite(id, req.user.id);
        if (!recipe) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy công thức."
            }));
        }

        return res.json(recipe);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.upsertReview = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã công thức không hợp lệ."
            }));
        }

        const recipe = await Recipe.upsertReview(id, req.user.id, req.body);
        if (!recipe) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy công thức."
            }));
        }

        return res.json(recipe);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.removeReview = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã công thức không hợp lệ."
            }));
        }

        const deleted = await Recipe.removeReview(id, req.user.id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy đánh giá của bạn cho công thức này."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa đánh giá thành công."
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
                message: "Mã công thức không hợp lệ."
            }));
        }

        const deleted = await Recipe.remove(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy công thức."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa công thức thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};
