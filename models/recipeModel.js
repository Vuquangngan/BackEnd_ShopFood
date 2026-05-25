const { Op, literal } = require("sequelize");
const {
    sequelize,
    Product,
    Recipe,
    RecipeCategory,
    RecipeFavorite,
    RecipeIngredient,
    RecipeReview,
    RecipeStep,
    User
} = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

function createRecipeError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

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

function localizeReview(review) {
    if (!review) return null;

    const user = localizeUser(review.user);

    return {
        ...addVietnameseAliases(review, {
            rating: "diem_danh_gia",
            comment: "binh_luan",
            username: "ten_nguoi_dung",
            user: "nguoi_dung"
        }),
        user,
        nguoi_dung: user
    };
}

function toPlainRecipe(recipeInstance) {
    if (!recipeInstance) return null;

    const recipe = recipeInstance.get({ plain: true });

    return {
        ...recipe,
        favorite_count: Number(recipe.favorite_count || 0),
        review_count: Number(recipe.review_count || 0),
        author_name: recipe.author ? recipe.author.username : null,
        recipe_category_name: recipe.recipe_category ? recipe.recipe_category.name : null,
        ingredients: (recipe.ingredients || []).map((ingredient) => ({
            ...ingredient,
            product_name: ingredient.product ? ingredient.product.name : null,
            product_slug: ingredient.product ? ingredient.product.slug : null
        })),
        reviews: (recipe.reviews || []).map((review) => ({
            ...review,
            username: review.user ? review.user.username : null
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
    const steps = (localized.steps || []).map(localizeStep);
    const reviews = (localized.reviews || []).map(localizeReview);

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
            review_count: "so_luot_danh_gia",
            author_name: "ten_tac_gia",
            recipe_category_name: "ten_danh_muc_cong_thuc",
            author: "tac_gia",
            recipe_category: "danh_muc_cong_thuc",
            ingredients: "danh_sach_nguyen_lieu",
            steps: "cac_buoc_thuc_hien",
            reviews: "danh_sach_danh_gia",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        author,
        tac_gia: author,
        recipe_category: recipeCategory,
        danh_muc_cong_thuc: recipeCategory,
        ingredients,
        danh_sach_nguyen_lieu: ingredients,
        steps,
        cac_buoc_thuc_hien: steps,
        reviews,
        danh_sach_danh_gia: reviews
    };
}

const recipeCountAttributes = [
    [literal(`(SELECT COUNT(*) FROM recipe_favorites rf WHERE rf.recipe_id = ${RECIPE_TABLE_ALIAS}.id)`), "favorite_count"],
    [literal(`(SELECT COUNT(*) FROM recipe_reviews rr WHERE rr.recipe_id = ${RECIPE_TABLE_ALIAS}.id)`), "review_count"]
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
                },
                {
                    model: RecipeReview,
                    as: "reviews",
                    separate: true,
                    order: [["created_at", "DESC"]],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "username"]
                        }
                    ]
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

    async upsertReview(recipeId, userId, data) {
        const recipe = await Recipe.findByPk(recipeId);
        if (!recipe) return null;

        const rating = Number(data.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw createRecipeError("Điểm đánh giá phải là số nguyên từ 1 đến 5.");
        }

        const existing = await RecipeReview.findOne({
            where: {
                recipe_id: recipeId,
                user_id: userId
            }
        });

        if (existing) {
            await existing.update({
                rating,
                comment: data.comment || null
            });
        } else {
            await RecipeReview.create({
                recipe_id: recipeId,
                user_id: userId,
                rating,
                comment: data.comment || null
            });
        }

        return this.getById(recipeId);
    },

    async removeReview(recipeId, userId) {
        const deletedRows = await RecipeReview.destroy({
            where: {
                recipe_id: recipeId,
                user_id: userId
            }
        });

        return deletedRows > 0;
    },

    async remove(id) {
        const deletedRows = await Recipe.destroy({
            where: { id }
        });

        return deletedRows > 0;
    }
};

module.exports = RecipeModel;
