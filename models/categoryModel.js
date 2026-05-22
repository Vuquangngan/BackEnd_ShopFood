const { Category } = require("./index");
const { addVietnameseAliases } = require("../utils/vietnameseLabels");

const CATEGORY_FIELDS = ["parent_id", "name", "slug", "description", "image_url", "is_active"];

function toPlainCategory(categoryInstance) {
    if (!categoryInstance) return null;
    return categoryInstance.get ? categoryInstance.get({ plain: true }) : categoryInstance;
}

function localizeCategory(category) {
    if (!category) return null;

    const children = (category.children || []).map(localizeCategory);
    const parent = category.parent ? addVietnameseAliases(category.parent, {
        name: "ten_danh_muc",
        slug: "duong_dan_slug"
    }) : null;

    return {
        ...addVietnameseAliases(category, {
            parent_id: "ma_danh_muc_cha",
            name: "ten_danh_muc",
            slug: "duong_dan_slug",
            description: "mo_ta",
            image_url: "duong_dan_anh",
            is_active: "dang_hien_thi",
            parent: "danh_muc_cha",
            children: "danh_muc_con",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        parent,
        danh_muc_cha: parent,
        children,
        danh_muc_con: children
    };
}

async function resolveParentId(parentId, currentId = null) {
    const nextParentId = Number(parentId || 0);
    if (!nextParentId) return null;
    if (currentId && nextParentId === Number(currentId)) {
        const error = new Error("Danh mục không thể chọn chính nó làm danh mục cha.");
        error.status = 400;
        throw error;
    }

    const parent = await Category.findByPk(nextParentId);
    if (!parent) {
        const error = new Error("Danh mục cha không tồn tại.");
        error.status = 400;
        throw error;
    }

    if (parent.parent_id) {
        const error = new Error("Chỉ được chọn danh mục cấp cha, không được chọn danh mục con làm cha.");
        error.status = 400;
        throw error;
    }

    return nextParentId;
}

const CategoryModel = {
    async getAll() {
        const categories = await Category.findAll({
            include: [
                {
                    model: Category,
                    as: "parent",
                    attributes: ["id", "name", "slug"]
                },
                {
                    model: Category,
                    as: "children",
                    separate: true,
                    attributes: ["id", "parent_id", "name", "slug", "description", "image_url", "is_active", "created_at", "updated_at"],
                    order: [["name", "ASC"]]
                }
            ],
            order: [["name", "ASC"]]
        });

        return categories.map((category) => localizeCategory(toPlainCategory(category)));
    },

    async getById(id) {
        const category = await Category.findByPk(id, {
            include: [
                {
                    model: Category,
                    as: "parent",
                    attributes: ["id", "name", "slug"]
                },
                {
                    model: Category,
                    as: "children",
                    separate: true,
                    attributes: ["id", "parent_id", "name", "slug", "description", "image_url", "is_active", "created_at", "updated_at"],
                    order: [["name", "ASC"]]
                }
            ]
        });

        return localizeCategory(toPlainCategory(category));
    },

    async create(data) {
        const parentId = await resolveParentId(data.parent_id);
        const category = await Category.create({
            parent_id: parentId,
            name: data.name,
            slug: data.slug,
            description: data.description || null,
            image_url: data.image_url || null,
            is_active: Object.prototype.hasOwnProperty.call(data, "is_active") ? Boolean(data.is_active) : true
        });

        return this.getById(category.id);
    },

    async update(id, data) {
        const category = await Category.findByPk(id);
        if (!category) return null;

        const updateData = {};
        CATEGORY_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });
        if (Object.prototype.hasOwnProperty.call(updateData, "parent_id")) {
            updateData.parent_id = await resolveParentId(updateData.parent_id, id);
        }

        if (Object.keys(updateData).length) {
            await category.update(updateData);
        }

        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await Category.destroy({ where: { id } });
        return deletedRows > 0;
    }
};

module.exports = CategoryModel;
