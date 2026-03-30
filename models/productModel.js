const { Op, literal } = require("sequelize");
const { sequelize, Category, Product, ProductImage, ProductReview, User } = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

const PRODUCT_FIELDS = [
    "category_id",
    "name",
    "slug",
    "sku",
    "short_description",
    "description",
    "price",
    "sale_price",
    "stock_quantity",
    "unit",
    "thumbnail_url",
    "is_featured",
    "is_published",
    "status"
];

const AVERAGE_RATING_SQL = "(SELECT COALESCE(AVG(pr.rating), 0) FROM product_reviews pr WHERE pr.product_id = Product.id)";
const REVIEW_COUNT_SQL = "(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)";
const CURRENT_PRICE_SQL = "COALESCE(Product.sale_price, Product.price)";

function normalizeImages(images = []) {
    if (!Array.isArray(images)) return [];

    return images
        .filter(Boolean)
        .map((image, index) => {
            if (typeof image === "string") {
                return {
                    image_url: image,
                    sort_order: index + 1
                };
            }

            return {
                image_url: image.image_url,
                sort_order: image.sort_order || index + 1
            };
        })
        .filter((image) => image.image_url);
}

function toPlain(instance) {
    if (!instance) return null;
    return instance.get ? instance.get({ plain: true }) : instance;
}

function localizeCategory(category) {
    if (!category) return null;

    return addVietnameseAliases(category, {
        name: "ten_danh_muc",
        slug: "duong_dan_slug"
    });
}

function localizeImage(image) {
    if (!image) return null;

    return addVietnameseAliases(image, {
        image_url: "duong_dan_anh",
        sort_order: "thu_tu_hien_thi",
        created_at: "ngay_tao"
    });
}

function localizeReviewUser(user) {
    if (!user) return null;

    return addVietnameseAliases({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url || null,
        role: user.role
    }, {
        username: "ten_nguoi_dung",
        avatar_url: "anh_dai_dien",
        role: "vai_tro"
    });
}

function localizeReview(review) {
    if (!review) return null;

    return {
        ...addVietnameseAliases(review, {
            user_id: "ma_nguoi_danh_gia",
            product_id: "ma_san_pham",
            rating: "so_sao",
            comment: "noi_dung_danh_gia",
            user: "nguoi_danh_gia",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        user: localizeReviewUser(review.user),
        nguoi_danh_gia: localizeReviewUser(review.user)
    };
}

function buildProductAttributes() {
    return {
        include: [
            [literal(AVERAGE_RATING_SQL), "average_rating"],
            [literal(REVIEW_COUNT_SQL), "review_count"],
            [literal(CURRENT_PRICE_SQL), "current_price"]
        ]
    };
}

function isProductPublic(product) {
    return Boolean(product.is_published) && ["active", "out_of_stock"].includes(product.status);
}

function normalizeProductState({ stockQuantity, isPublished, currentStatus }) {
    const stock = Number(stockQuantity || 0);

    if (currentStatus === "archived") {
        return {
            stock_quantity: stock,
            is_published: isPublished,
            status: "archived"
        };
    }

    if (stock <= 0) {
        return {
            stock_quantity: 0,
            is_published: isPublished,
            status: "out_of_stock"
        };
    }

    if (!isPublished) {
        return {
            stock_quantity: stock,
            is_published: false,
            status: "draft"
        };
    }

    return {
        stock_quantity: stock,
        is_published: true,
        status: "active"
    };
}

function toPlainProduct(productInstance) {
    if (!productInstance) return null;

    const product = productInstance.get({ plain: true });
    const stockQuantity = Number(product.stock_quantity || 0);
    const isSellable = Boolean(product.is_published) && product.status === "active" && stockQuantity > 0;

    return {
        ...product,
        category_name: product.category ? product.category.name : null,
        images: product.images || [],
        reviews: product.reviews || [],
        average_rating: Number(product.average_rating || 0),
        review_count: Number(product.review_count || 0),
        current_price: Number(product.current_price || product.sale_price || product.price || 0),
        is_sellable: isSellable
    };
}

function localizeProduct(product) {
    if (!product) return null;

    const localized = addVietnameseLabels(product, {
        status: "product_status"
    });

    const images = (localized.images || []).map(localizeImage);
    const category = localizeCategory(localized.category);
    const reviews = (localized.reviews || []).map(localizeReview);

    return {
        ...addVietnameseAliases(localized, {
            category_id: "ma_danh_muc",
            name: "ten_san_pham",
            slug: "duong_dan_slug",
            sku: "ma_sku",
            short_description: "mo_ta_ngan",
            description: "mo_ta",
            price: "gia_ban",
            sale_price: "gia_khuyen_mai",
            current_price: "gia_hien_tai",
            stock_quantity: "so_luong_ton",
            unit: "don_vi",
            thumbnail_url: "anh_dai_dien",
            is_featured: "san_pham_noi_bat",
            is_published: "dang_ban",
            is_sellable: "co_the_ban",
            status: "trang_thai_ma",
            status_label: "trang_thai_hien_thi",
            category_name: "ten_danh_muc",
            average_rating: "diem_danh_gia_trung_binh",
            review_count: "tong_so_danh_gia",
            category: "danh_muc",
            images: "danh_sach_hinh_anh",
            reviews: "danh_sach_danh_gia",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        category,
        danh_muc: category,
        images,
        danh_sach_hinh_anh: images,
        reviews,
        danh_sach_danh_gia: reviews
    };
}

function buildSortOrder(sortBy) {
    switch (sortBy) {
    case "price_asc":
        return [[literal(CURRENT_PRICE_SQL), "ASC"]];
    case "price_desc":
        return [[literal(CURRENT_PRICE_SQL), "DESC"]];
    case "name_asc":
        return [["name", "ASC"]];
    case "name_desc":
        return [["name", "DESC"]];
    case "rating_desc":
        return [[literal(AVERAGE_RATING_SQL), "DESC"], [literal(REVIEW_COUNT_SQL), "DESC"], ["created_at", "DESC"]];
    case "oldest":
        return [["created_at", "ASC"]];
    default:
        return [["created_at", "DESC"]];
    }
}

async function getRatingSummary(productId) {
    const summary = await Product.findByPk(productId, {
        attributes: buildProductAttributes()
    });

    if (!summary) return null;

    const plain = toPlainProduct(summary);
    return {
        average_rating: plain.average_rating,
        review_count: plain.review_count,
        diem_danh_gia_trung_binh: plain.average_rating,
        tong_so_danh_gia: plain.review_count
    };
}

const ProductModel = {
    async getAll(filters = {}) {
        const whereClauses = [];
        const onlyPublic = filters.only_public === true || filters.only_public === "true";

        if (filters.category_id) {
            whereClauses.push({ category_id: Number(filters.category_id) });
        }

        if (onlyPublic) {
            whereClauses.push({ is_published: true });
            whereClauses.push({ status: { [Op.in]: ["active", "out_of_stock"] } });
        } else {
            if (filters.status) {
                whereClauses.push({ status: filters.status });
            }

            if (filters.is_published === "true") {
                whereClauses.push({ is_published: true });
            }

            if (filters.is_published === "false") {
                whereClauses.push({ is_published: false });
            }
        }

        if (filters.keyword) {
            whereClauses.push({
                [Op.or]: [
                    { name: { [Op.like]: `%${filters.keyword}%` } },
                    { slug: { [Op.like]: `%${filters.keyword}%` } },
                    { sku: { [Op.like]: `%${filters.keyword}%` } },
                    { short_description: { [Op.like]: `%${filters.keyword}%` } }
                ]
            });
        }

        if (filters.in_stock === "true") {
            whereClauses.push({ stock_quantity: { [Op.gt]: 0 } });
        }

        if (filters.is_featured === "true") {
            whereClauses.push({ is_featured: true });
        }

        if (filters.min_price !== undefined && filters.min_price !== "") {
            whereClauses.push(sequelize.where(literal(CURRENT_PRICE_SQL), { [Op.gte]: Number(filters.min_price) }));
        }

        if (filters.max_price !== undefined && filters.max_price !== "") {
            whereClauses.push(sequelize.where(literal(CURRENT_PRICE_SQL), { [Op.lte]: Number(filters.max_price) }));
        }

        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 12, 1), 100);
        const offset = (page - 1) * limit;

        const { rows, count } = await Product.findAndCountAll({
            where: whereClauses.length ? { [Op.and]: whereClauses } : {},
            attributes: buildProductAttributes(),
            include: [
                {
                    model: Category,
                    as: "category",
                    attributes: ["id", "name", "slug"]
                },
                {
                    model: ProductImage,
                    as: "images",
                    separate: true,
                    order: [["sort_order", "ASC"], ["id", "ASC"]]
                }
            ],
            order: buildSortOrder(filters.sort_by),
            limit,
            offset,
            distinct: true
        });

        const items = rows.map((product) => localizeProduct(toPlainProduct(product)));

        return {
            items,
            danh_sach_san_pham: items,
            pagination: addVietnameseAliases({
                page,
                limit,
                total: count,
                total_pages: Math.max(Math.ceil(count / limit), 1)
            }, {
                total_pages: "tong_so_trang"
            })
        };
    },

    async getById(id, options = {}) {
        const product = await Product.findByPk(id, {
            attributes: buildProductAttributes(),
            include: [
                {
                    model: Category,
                    as: "category",
                    attributes: ["id", "name", "slug"]
                },
                {
                    model: ProductImage,
                    as: "images",
                    separate: true,
                    order: [["sort_order", "ASC"], ["id", "ASC"]]
                },
                {
                    model: ProductReview,
                    as: "reviews",
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "username", "email", "avatar_url", "role"]
                        }
                    ],
                    separate: true,
                    limit: 5,
                    order: [["created_at", "DESC"]]
                }
            ]
        });

        const plain = toPlainProduct(product);
        if (!plain) return null;

        if (options.only_public && !isProductPublic(plain)) {
            return null;
        }

        return localizeProduct(plain);
    },

    async getReviews(productId, filters = {}) {
        const product = await Product.findByPk(productId);
        if (!product) return null;

        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
        const offset = (page - 1) * limit;

        const { rows, count } = await ProductReview.findAndCountAll({
            where: { product_id: productId },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "username", "email", "avatar_url", "role"]
                }
            ],
            order: [["created_at", "DESC"]],
            limit,
            offset
        });

        const items = rows.map((review) => localizeReview(toPlain(review)));

        return {
            product_id: productId,
            ma_san_pham: productId,
            items,
            danh_sach_danh_gia: items,
            summary: await getRatingSummary(productId),
            pagination: addVietnameseAliases({
                page,
                limit,
                total: count,
                total_pages: Math.max(Math.ceil(count / limit), 1)
            }, {
                total_pages: "tong_so_trang"
            })
        };
    },

    async upsertReview(productId, userId, data) {
        const product = await Product.findByPk(productId);
        if (!product) return null;

        const rating = Number(data.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            const error = new Error("Số sao đánh giá phải nằm trong khoảng từ 1 đến 5.");
            error.statusCode = 400;
            throw error;
        }

        let review = await ProductReview.findOne({
            where: {
                product_id: productId,
                user_id: userId
            }
        });

        if (review) {
            await review.update({
                rating,
                comment: data.comment ? String(data.comment).trim() : null
            });
        } else {
            review = await ProductReview.create({
                product_id: productId,
                user_id: userId,
                rating,
                comment: data.comment ? String(data.comment).trim() : null
            });
        }

        const detailedReview = await ProductReview.findByPk(review.id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "username", "email", "avatar_url", "role"]
                }
            ]
        });

        return {
            review: localizeReview(toPlain(detailedReview)),
            danh_gia: localizeReview(toPlain(detailedReview)),
            summary: await getRatingSummary(productId)
        };
    },

    async create(data) {
        let productId;

        await sequelize.transaction(async (transaction) => {
            const requestedPublished = data.is_published === true || data.is_published === "true";
            const requestedStatus = data.status || null;
            const normalizedState = normalizeProductState({
                stockQuantity: data.stock_quantity || 0,
                isPublished: requestedPublished,
                currentStatus: requestedStatus
            });

            const product = await Product.create({
                category_id: data.category_id,
                name: data.name,
                slug: data.slug,
                sku: data.sku,
                short_description: data.short_description || null,
                description: data.description || null,
                price: data.price,
                sale_price: data.sale_price || null,
                stock_quantity: normalizedState.stock_quantity,
                unit: data.unit || "don vi",
                thumbnail_url: data.thumbnail_url || null,
                is_featured: Boolean(data.is_featured),
                is_published: normalizedState.is_published,
                status: normalizedState.status
            }, { transaction });

            productId = product.id;

            const images = normalizeImages(data.images);
            if (images.length) {
                await ProductImage.bulkCreate(
                    images.map((image) => ({
                        product_id: product.id,
                        image_url: image.image_url,
                        sort_order: image.sort_order
                    })),
                    { transaction }
                );
            }
        });

        return this.getById(productId);
    },

    async update(id, data) {
        const product = await Product.findByPk(id);
        if (!product) return null;

        await sequelize.transaction(async (transaction) => {
            const updateData = {};

            PRODUCT_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    updateData[field] = data[field];
                }
            });

            const mergedStock = Object.prototype.hasOwnProperty.call(updateData, "stock_quantity")
                ? Number(updateData.stock_quantity)
                : Number(product.stock_quantity);
            const mergedPublished = Object.prototype.hasOwnProperty.call(updateData, "is_published")
                ? (updateData.is_published === true || updateData.is_published === "true")
                : Boolean(product.is_published);
            const mergedStatus = Object.prototype.hasOwnProperty.call(updateData, "status")
                ? updateData.status
                : product.status;

            const normalizedState = normalizeProductState({
                stockQuantity: mergedStock,
                isPublished: mergedPublished,
                currentStatus: mergedStatus
            });

            updateData.stock_quantity = normalizedState.stock_quantity;
            updateData.is_published = normalizedState.is_published;
            updateData.status = normalizedState.status;

            if (Object.keys(updateData).length) {
                await product.update(updateData, { transaction });
            }

            if (Array.isArray(data.images)) {
                await ProductImage.destroy({
                    where: { product_id: id },
                    transaction
                });

                const images = normalizeImages(data.images);
                if (images.length) {
                    await ProductImage.bulkCreate(
                        images.map((image) => ({
                            product_id: id,
                            image_url: image.image_url,
                            sort_order: image.sort_order
                        })),
                        { transaction }
                    );
                }
            }
        });

        return this.getById(id);
    },

    async publish(id) {
        const product = await Product.findByPk(id);
        if (!product) return null;

        const nextState = normalizeProductState({
            stockQuantity: product.stock_quantity,
            isPublished: true,
            currentStatus: product.status
        });

        await product.update(nextState);
        return this.getById(id);
    },

    async unpublish(id) {
        const product = await Product.findByPk(id);
        if (!product) return null;

        const nextState = normalizeProductState({
            stockQuantity: product.stock_quantity,
            isPublished: false,
            currentStatus: product.status === "archived" ? "archived" : "draft"
        });

        await product.update(nextState);
        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await Product.destroy({ where: { id } });
        return deletedRows > 0;
    }
};

module.exports = ProductModel;
