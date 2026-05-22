const RecipeCategory = require("../models/recipeCategoryModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Slug của danh mục công thức đã tồn tại."
        }));
    }

    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Không thể xóa danh mục công thức đang được sử dụng."
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getAll = async (req, res) => {
    try {
        const categories = await RecipeCategory.getAll();
        return res.json(categories);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã danh mục công thức không hợp lệ."
            }));
        }

        const category = await RecipeCategory.getById(id);
        if (!category) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục công thức."
            }));
        }

        return res.json(category);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.create = async (req, res) => {
    try {
        const { name, slug } = req.body;
        if (!name || !slug) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập tên và slug cho danh mục công thức."
            }));
        }

        const category = await RecipeCategory.create(req.body);
        return res.status(201).json(category);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã danh mục công thức không hợp lệ."
            }));
        }

        const category = await RecipeCategory.update(id, req.body);
        if (!category) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục công thức."
            }));
        }

        return res.json(category);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.remove = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mã danh mục công thức không hợp lệ."
            }));
        }

        const deleted = await RecipeCategory.remove(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục công thức."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa danh mục công thức thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};
