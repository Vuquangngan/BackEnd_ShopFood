const { literal } = require("sequelize");
const { RecipeCategory } = require("./index");
const { addVietnameseAliases } = require("../utils/vietnameseLabels");

const RECIPE_CATEGORY_FIELDS = ["name", "slug", "description", "image_url", "color_hex", "is_active"];
const RECIPE_CATEGORY_TABLE_ALIAS = "\"RecipeCategory\"";

function toPlainRecipeCategory(categoryInstance) {
    if (!categoryInstance) return null;
    return categoryInstance.get ? categoryInstance.get({ plain: true }) : categoryInstance;
}

function localizeRecipeCategory(category) {
    if (!category) return null;

    return addVietnameseAliases(category, {
        name: "ten_danh_muc",
        slug: "duong_dan_slug",
        description: "mo_ta",
        image_url: "duong_dan_anh",
        color_hex: "ma_mau",
        is_active: "dang_hien_thi",
        recipe_count: "so_cong_thuc",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

const RecipeCategoryModel = {
    async getAll() {
        const categories = await RecipeCategory.findAll({
            attributes: {
                include: [
                    [literal(`(SELECT COUNT(*) FROM recipes r WHERE r.recipe_category_id = ${RECIPE_CATEGORY_TABLE_ALIAS}.id)`), "recipe_count"]
                ]
            },
            order: [["name", "ASC"]]
        });

        return categories.map((category) => localizeRecipeCategory(toPlainRecipeCategory(category)));
    },

    async getById(id) {
        const category = await RecipeCategory.findByPk(id, {
            attributes: {
                include: [
                    [literal(`(SELECT COUNT(*) FROM recipes r WHERE r.recipe_category_id = ${RECIPE_CATEGORY_TABLE_ALIAS}.id)`), "recipe_count"]
                ]
            }
        });

        return localizeRecipeCategory(toPlainRecipeCategory(category));
    },

    async create(data) {
        const category = await RecipeCategory.create({
            name: data.name,
            slug: data.slug,
            description: data.description || null,
            image_url: data.image_url || null,
            color_hex: data.color_hex || null,
            is_active: Object.prototype.hasOwnProperty.call(data, "is_active") ? Boolean(data.is_active) : true
        });

        return this.getById(category.id);
    },

    async update(id, data) {
        const category = await RecipeCategory.findByPk(id);
        if (!category) return null;

        const updateData = {};
        RECIPE_CATEGORY_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (Object.keys(updateData).length) {
            await category.update(updateData);
        }

        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await RecipeCategory.destroy({ where: { id } });
        return deletedRows > 0;
    }
};

module.exports = RecipeCategoryModel;
