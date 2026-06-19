const { Op, literal } = require("sequelize");
const {
    sequelize,
    Product,
    Recipe,
    RecipeCategory,
    RecipeFavorite,
    RecipeIngredient,
    RecipeStep,
    User
} = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

const RECIPE_FIELDS = [
    "author_id",
    "recipe_category_id",
    "title",
    "slug",
    "description",
    "image_url",
    "prep_time_minutes",
    "cook_time_minutes",
    "servings",
    "difficulty",
    "calories",
    "status"
];
const RECIPE_TABLE_ALIAS = "\"Recipe\"";

function normalizeIngredients(ingredients = []) {
    if (!Array.isArray(ingredients)) return [];

    return ingredients
        .filter(Boolean)
        .map((ingredient, index) => {
            if (typeof ingredient === "string") {
                return {
                    product_id: null,
                    ingredient_name: ingredient,
                    quantity: 1,
                    unit: "đơn vị",
                    note: null,
                    sort_order: index + 1
                };
            }

            return {
                product_id: ingredient.product_id || null,
                ingredient_name: ingredient.ingredient_name,
                quantity: ingredient.quantity || 1,
                unit: ingredient.unit || "đơn vị",
                note: ingredient.note || null,
                sort_order: ingredient.sort_order || index + 1
            };
        })
        .filter((ingredient) => ingredient.ingredient_name);
}

function normalizeDisplayIngredients(ingredients = []) {
    if (!Array.isArray(ingredients)) return [];

    return ingredients
        .filter(Boolean)
        .map((ingredient, index) => {
            if (typeof ingredient === "string") {
                return {
                    name: ingredient.trim(),
                    quantity: "",
                    unit: "",
                    note: "",
                    sort_order: index + 1
                };
            }

            return {
                name: String(ingredient.name || ingredient.ingredient_name || ingredient.ten_nguyen_lieu || "").trim(),
                quantity: ingredient.quantity ?? ingredient.so_luong ?? "",
                unit: ingredient.unit || ingredient.don_vi || "",
                note: ingredient.note || ingredient.ghi_chu || "",
                sort_order: ingredient.sort_order || ingredient.thu_tu_hien_thi || index + 1
            };
        })
        .filter((ingredient) => ingredient.name);
}

function parseDisplayIngredients(value) {
    if (Array.isArray(value)) return normalizeDisplayIngredients(value);
    if (!value || typeof value !== "string") return [];

    try {
        return normalizeDisplayIngredients(JSON.parse(value));
    } catch (error) {
        return [];
    }
}

function stringifyDisplayIngredients(value) {
    const ingredients = normalizeDisplayIngredients(value);
    return ingredients.length ? JSON.stringify(ingredients) : null;
}

function normalizeSteps(steps = []) {
    if (!Array.isArray(steps)) return [];

    return steps
        .filter(Boolean)
        .map((step, index) => {
            if (typeof step === "string") {
                return {
                    step_number: index + 1,
                    instruction: step,
                    image_url: null
                };
            }

            return {
                step_number: step.step_number || index + 1,
                instruction: step.instruction,
                image_url: step.image_url || null
            };
        })
        .filter((step) => step.instruction);
}

function localizeUser(user) {
    if (!user) return null;

    return addVietnameseAliases(user, {
        username: "ten_nguoi_dung",
        role: "vai_tro_ma",
        role_label: "vai_tro_hien_thi",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi"
    });
}

function localizeProduct(product) {
    if (!product) return null;

    return addVietnameseAliases(product, {
        name: "ten_san_pham",
        slug: "duong_dan_slug"
    });
}

function localizeRecipeCategory(category) {
    if (!category) return null;

    return addVietnameseAliases(category, {
        name: "ten_danh_muc",
        slug: "duong_dan_slug",
        description: "mo_ta",
        image_url: "duong_dan_anh",
        color_hex: "ma_mau",
        is_active: "dang_hien_thi"
    });
}

function localizeIngredient(ingredient) {
    if (!ingredient) return null;

    const product = localizeProduct(ingredient.product);

    return {
        ...addVietnameseAliases(ingredient, {
            product_id: "ma_san_pham",
            ingredient_name: "ten_nguyen_lieu",
            quantity: "so_luong",
            unit: "don_vi",
            note: "ghi_chu",
            sort_order: "thu_tu_hien_thi",
            product_name: "ten_san_pham",
            product_slug: "duong_dan_slug_san_pham",
            product: "san_pham"
        }),
        product,
        san_pham: product
    };
}

function localizeStep(step) {
    if (!step) return null;

    return addVietnameseAliases(step, {
        step_number: "so_buoc",
        instruction: "huong_dan",
        image_url: "duong_dan_anh"
    });
}

function toPlainRecipe(recipeInstance) {
    if (!recipeInstance) return null;

    const recipe = recipeInstance.get({ plain: true });

    return {
        ...recipe,
        display_ingredients: parseDisplayIngredients(recipe.display_ingredients),
        favorite_count: Number(recipe.favorite_count || 0),
        author_name: recipe.author ? recipe.author.username : null,
        recipe_category_name: recipe.recipe_category ? recipe.recipe_category.name : null,
        ingredients: (recipe.ingredients || []).map((ingredient) => ({
            ...ingredient,
            product_name: ingredient.product ? ingredient.product.name : null,
            product_slug: ingredient.product ? ingredient.product.slug : null
        }))
    };
}

function localizeRecipe(recipe) {
    if (!recipe) return null;

    const localized = addVietnameseLabels(recipe, {
        difficulty: "recipe_difficulty",
        status: "recipe_status"
    });

    const author = localizeUser(localized.author);
    const recipeCategory = localizeRecipeCategory(localized.recipe_category);
    const ingredients = (localized.ingredients || []).map(localizeIngredient);
    const displayIngredients = parseDisplayIngredients(localized.display_ingredients);
    const steps = (localized.steps || []).map(localizeStep);

    return {
        ...addVietnameseAliases(localized, {
            author_id: "ma_tac_gia",
            recipe_category_id: "ma_danh_muc_cong_thuc",
            title: "ten_cong_thuc",
            slug: "duong_dan_slug",
            description: "mo_ta",
            image_url: "duong_dan_anh",
            prep_time_minutes: "thoi_gian_chuan_bi_phut",
            cook_time_minutes: "thoi_gian_nau_phut",
            servings: "khau_phan",
            difficulty: "do_kho_ma",
            difficulty_label: "do_kho_hien_thi",
            calories: "calo",
            status: "trang_thai_ma",
            status_label: "trang_thai_hien_thi",
            favorite_count: "so_luot_yeu_thich",
            author_name: "ten_tac_gia",
            recipe_category_name: "ten_danh_muc_cong_thuc",
            author: "tac_gia",
            recipe_category: "danh_muc_cong_thuc",
            ingredients: "danh_sach_nguyen_lieu",
            display_ingredients: "nguyen_lieu_chuan_bi",
            steps: "cac_buoc_thuc_hien",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        author,
        tac_gia: author,
        recipe_category: recipeCategory,
        danh_muc_cong_thuc: recipeCategory,
        ingredients,
        danh_sach_nguyen_lieu: ingredients,
        display_ingredients: displayIngredients,
        nguyen_lieu_chuan_bi: displayIngredients,
        steps,
        cac_buoc_thuc_hien: steps
    };
}

const recipeCountAttributes = [
    [literal(`(SELECT COUNT(*) FROM recipe_favorites rf WHERE rf.recipe_id = ${RECIPE_TABLE_ALIAS}.id)`), "favorite_count"]
];

const RecipeModel = {
    async getAll(filters = {}) {
        const where = {};

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.difficulty) {
            where.difficulty = filters.difficulty;
        }

        if (filters.recipe_category_id) {
            where.recipe_category_id = Number(filters.recipe_category_id);
        }

        if (filters.keyword) {
            where[Op.or] = [
                { title: { [Op.like]: `%${filters.keyword}%` } },
                { slug: { [Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const recipes = await Recipe.findAll({
            where,
            attributes: {
                include: recipeCountAttributes
            },
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username"]
                },
                {
                    model: RecipeCategory,
                    as: "recipe_category",
                    attributes: ["id", "name", "slug", "description", "image_url", "color_hex", "is_active"]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        return recipes.map((recipe) => localizeRecipe(toPlainRecipe(recipe)));
    },

    async getById(id) {
        const recipe = await Recipe.findByPk(id, {
            attributes: {
                include: recipeCountAttributes
            },
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username"]
                },
                {
                    model: RecipeCategory,
                    as: "recipe_category",
                    attributes: ["id", "name", "slug", "description", "image_url", "color_hex", "is_active"]
                },
                {
                    model: RecipeIngredient,
                    as: "ingredients",
                    separate: true,
                    order: [["sort_order", "ASC"], ["id", "ASC"]],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["id", "name", "slug"]
                        }
                    ]
                },
                {
                    model: RecipeStep,
                    as: "steps",
                    separate: true,
                    order: [["step_number", "ASC"], ["id", "ASC"]]
                }
            ]
        });

        return localizeRecipe(toPlainRecipe(recipe));
    },

    async create(data) {
        let recipeId;

        await sequelize.transaction(async (transaction) => {
            const recipe = await Recipe.create({
                author_id: data.author_id || null,
                recipe_category_id: data.recipe_category_id || null,
                title: data.title,
                slug: data.slug,
                description: data.description || null,
                image_url: data.image_url || null,
                display_ingredients: stringifyDisplayIngredients(
                    data.display_ingredients || data.nguyen_lieu_chuan_bi || data.prep_ingredients || []
                ),
                prep_time_minutes: data.prep_time_minutes || 0,
                cook_time_minutes: data.cook_time_minutes || 0,
                servings: data.servings || 1,
                difficulty: data.difficulty || "easy",
                calories: data.calories || null,
                status: data.status || "published"
            }, { transaction });

            recipeId = recipe.id;

            const ingredients = normalizeIngredients(data.ingredients);
            const steps = normalizeSteps(data.steps);

            if (ingredients.length) {
                await RecipeIngredient.bulkCreate(
                    ingredients.map((ingredient) => ({
                        recipe_id: recipe.id,
                        product_id: ingredient.product_id,
                        ingredient_name: ingredient.ingredient_name,
                        quantity: ingredient.quantity,
                        unit: ingredient.unit,
                        note: ingredient.note,
                        sort_order: ingredient.sort_order
                    })),
                    { transaction }
                );
            }

            if (steps.length) {
                await RecipeStep.bulkCreate(
                    steps.map((step) => ({
                        recipe_id: recipe.id,
                        step_number: step.step_number,
                        instruction: step.instruction,
                        image_url: step.image_url
                    })),
                    { transaction }
                );
            }
        });

        return this.getById(recipeId);
    },

    async update(id, data) {
        const recipe = await Recipe.findByPk(id);

        if (!recipe) return null;

        await sequelize.transaction(async (transaction) => {
            const updateData = {};

            RECIPE_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    updateData[field] = data[field];
                }
            });
            if (
                Object.prototype.hasOwnProperty.call(data, "display_ingredients")
                || Object.prototype.hasOwnProperty.call(data, "nguyen_lieu_chuan_bi")
                || Object.prototype.hasOwnProperty.call(data, "prep_ingredients")
            ) {
                updateData.display_ingredients = stringifyDisplayIngredients(
                    data.display_ingredients || data.nguyen_lieu_chuan_bi || data.prep_ingredients || []
                );
            }

            if (Object.keys(updateData).length) {
                await recipe.update(updateData, { transaction });
            }

            if (Array.isArray(data.ingredients)) {
                await RecipeIngredient.destroy({
                    where: { recipe_id: id },
                    transaction
                });

                const ingredients = normalizeIngredients(data.ingredients);

                if (ingredients.length) {
                    await RecipeIngredient.bulkCreate(
                        ingredients.map((ingredient) => ({
                            recipe_id: id,
                            product_id: ingredient.product_id,
                            ingredient_name: ingredient.ingredient_name,
                            quantity: ingredient.quantity,
                            unit: ingredient.unit,
                            note: ingredient.note,
                            sort_order: ingredient.sort_order
                        })),
                        { transaction }
                    );
                }
            }

            if (Array.isArray(data.steps)) {
                await RecipeStep.destroy({
                    where: { recipe_id: id },
                    transaction
                });

                const steps = normalizeSteps(data.steps);

                if (steps.length) {
                    await RecipeStep.bulkCreate(
                        steps.map((step) => ({
                            recipe_id: id,
                            step_number: step.step_number,
                            instruction: step.instruction,
                            image_url: step.image_url
                        })),
                        { transaction }
                    );
                }
            }
        });

        return this.getById(id);
    },

    async toggleFavorite(recipeId, userId) {
        const recipe = await Recipe.findByPk(recipeId);
        if (!recipe) return null;

        const existing = await RecipeFavorite.findOne({
            where: {
                recipe_id: recipeId,
                user_id: userId
            }
        });

        let isFavorite = false;

        if (existing) {
            await existing.destroy();
        } else {
            await RecipeFavorite.create({
                recipe_id: recipeId,
                user_id: userId
            });
            isFavorite = true;
        }

        const recipeData = await this.getById(recipeId);
        return {
            ...recipeData,
            is_favorite: isFavorite,
            da_yeu_thich: isFavorite
        };
    },

    async remove(id) {
        const deletedRows = await Recipe.destroy({
            where: { id }
        });

        return deletedRows > 0;
    }
};

module.exports = RecipeModel;
