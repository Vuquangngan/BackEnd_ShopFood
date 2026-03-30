const Category = require("../models/categoryModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Tên định danh (slug) của danh mục đã tồn tại."
        }));
    }

    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Danh mục cha không tồn tại."
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Đã xảy ra lỗi máy chủ."
    }));
}

exports.getAll = async (req, res) => {
    try {
        const categories = await Category.getAll();
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
                message: "Mã danh mục không hợp lệ."
            }));
        }

        const category = await Category.getById(id);
        if (!category) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục."
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
                message: "Vui lòng nhập đầy đủ tên danh mục và đường dẫn định danh (slug)."
            }));
        }

        const category = await Category.create(req.body);
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
                message: "Mã danh mục không hợp lệ."
            }));
        }

        const category = await Category.update(id, req.body);
        if (!category) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục."
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
                message: "Mã danh mục không hợp lệ."
            }));
        }

        const deleted = await Category.remove(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy danh mục."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Xóa danh mục thành công."
        }));
    } catch (error) {
        return handleError(res, error);
    }
};