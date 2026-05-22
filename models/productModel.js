const { Op, literal } = require("sequelize");
const { sequelize, Category, Product, ProductImage, ProductReview, ProductStoreAllocation, User } = require("./index");
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
    "stock_unit",
    "stock_per_sale_unit",
    "sale_unit",
    "unit",
    "production_date",
    "expiration_date",
    "thumbnail_url",
    "is_featured",
    "is_published",
    "status"
];

const AVERAGE_RATING_SQL = "(SELECT COALESCE(AVG(pr.rating), 0) FROM product_reviews pr WHERE pr.product_id = Product.id)";
const REVIEW_COUNT_SQL = "(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)";
const CURRENT_PRICE_SQL = "COALESCE(Product.sale_price, Product.price)";
const LATEST_SUPPLIER_NAME_SQL = `(
    SELECT s.name
    FROM inventory_document_items idi
    INNER JOIN inventory_documents idoc ON idoc.id = idi.document_id
    INNER JOIN suppliers s ON s.id = idoc.supplier_id
    WHERE idi.product_id = Product.id
      AND idoc.supplier_id IS NOT NULL
      AND idoc.type = 'receipt'
      AND idoc.status = 'completed'
    ORDER BY COALESCE(idoc.completed_at, idoc.created_at) DESC, idoc.id DESC, idi.id DESC
    LIMIT 1
)`;
const STOCK_PRECISION = 3;
const STORE_BRANCHES = [
    { key: "store_1", label: "Cửa hàng 1", name: "Chi nhánh trung tâm" },
    { key: "store_2", label: "Cửa hàng 2", name: "Chi nhánh phía Đông" },
    { key: "store_3", label: "Cửa hàng 3", name: "Chi nhánh phía Tây" }
];

async function resolveCategoryIdInput(data, { allowMissing = false } = {}) {
    if (data.category_id !== undefined && data.category_id !== null && data.category_id !== "") {
        const categoryId = Number(data.category_id);
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            const error = new Error("category_id không hợp lệ.");
            error.statusCode = 400;
            throw error;
        }
        return categoryId;
    }

    if (data.category_slug !== undefined && data.category_slug !== null && String(data.category_slug).trim() !== "") {
        const category = await Category.findOne({
            where: { slug: String(data.category_slug).trim() }
        });

        if (!category) {
            const error = new Error("Danh mục không tồn tại.");
            error.statusCode = 400;
            throw error;
        }

        return category.id;
    }

    if (allowMissing) {
        return null;
    }

    const error = new Error("Vui lòng nhập category_id hoặc category_slug.");
    error.statusCode = 400;
    throw error;
}

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

function roundStockQuantity(value) {
    return Number(Number(value || 0).toFixed(STOCK_PRECISION));
}

function slugifyText(value, fallback = "san-pham") {
    const normalized = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    return normalized || fallback;
}

async function generateUniqueProductSlug(name, requestedSlug, transaction) {
    const baseSlug = slugifyText(requestedSlug || name, "san-pham");
    let candidate = baseSlug;
    let suffix = 2;

    while (await Product.findOne({ where: { slug: candidate }, transaction })) {
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

async function generateUniqueProductSku(name, requestedSku, transaction) {
    const preferredSku = String(requestedSku || "").trim().toUpperCase();
    const baseSku = preferredSku || `SKU-${slugifyText(name, "san-pham").replace(/-/g, "-").toUpperCase()}`;
    let candidate = baseSku;
    let suffix = 2;

    while (await Product.findOne({ where: { sku: candidate }, transaction })) {
        candidate = `${baseSku}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

function normalizePositiveStockQuantity(value, fieldName, { allowZero = true } = {}) {
    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || (!allowZero && normalizedValue <= 0)) {
        const error = new Error(`${fieldName} khong hop le.`);
        error.statusCode = 400;
        throw error;
    }

    return roundStockQuantity(normalizedValue);
}

function resolveStockUnitValue(data = {}, fallback = "don vi") {
    return String(data.stock_unit || fallback || "don vi").trim() || "don vi";
}

function resolveSaleUnitValue(data = {}, fallback = "don vi") {
    return String(data.sale_unit || data.unit || fallback || "don vi").trim() || "don vi";
}

function resolveStockPerSaleUnitValue(data = {}, fallback = 1) {
    const rawValue = data.stock_per_sale_unit;
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return normalizePositiveStockQuantity(fallback, "So luong quy doi", { allowZero: false });
    }

    return normalizePositiveStockQuantity(rawValue, "So luong quy doi", { allowZero: false });
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
            [literal(CURRENT_PRICE_SQL), "current_price"],
            [literal(LATEST_SUPPLIER_NAME_SQL), "supplier_name"]
        ]
    };
}

function isProductPublic(product) {
    return Boolean(product.is_published) && ["active", "out_of_stock"].includes(product.status);
}

function getStockPerSaleUnit(product = {}) {
    const normalized = Number(product.stock_per_sale_unit || 1);
    return Number.isFinite(normalized) && normalized > 0
        ? roundStockQuantity(normalized)
        : 1;
}

function getAvailableSaleQuantity(product = {}) {
    const stockQuantity = Number(product.stock_quantity || 0);
    const stockPerSaleUnit = getStockPerSaleUnit(product);
    if (stockQuantity <= 0 || stockPerSaleUnit <= 0) {
        return 0;
    }

    return Math.floor((stockQuantity + Number.EPSILON) / stockPerSaleUnit);
}

function hasRemainingWarehouseStock(product = {}) {
    return Number(product.stock_quantity || 0) > 0;
}

function normalizeProductState({ stockQuantity, isPublished, currentStatus, stockPerSaleUnit = 1 }) {
    const stock = roundStockQuantity(stockQuantity || 0);
    const availableSaleQuantity = getAvailableSaleQuantity({
        stock_quantity: stock,
        stock_per_sale_unit: stockPerSaleUnit
    });

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
        status: stock > 0 ? "active" : "out_of_stock"
    };
}

function normalizeOptionalPrice(value, fieldName) {
    if (value === undefined) {
        return { hasValue: false, value: undefined };
    }

    if (value === null || value === "") {
        return { hasValue: true, value: null };
    }

    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
        const error = new Error(`${fieldName} khong hop le.`);
        error.statusCode = 400;
        throw error;
    }

    return {
        hasValue: true,
        value: Number(normalizedValue.toFixed(2))
    };
}

function getStoreBranch(storeKey) {
    const key = String(storeKey || "").trim();
    if (!key) return null;

    const staticBranch = STORE_BRANCHES.find((branch) => branch.key === key);
    if (staticBranch) return staticBranch;

    if (!/^[a-zA-Z0-9_-]{2,80}$/.test(key)) return null;

    return {
        key,
        label: key,
        name: key
    };
}

function resolveStoreBranchName(storeBranch, data = {}) {
    const label = String(data.store_label || data.branch_label || storeBranch.label || "").trim();
    const name = String(data.store_name || data.branch_name || storeBranch.name || "").trim();
    const parts = [label, name].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
    return parts.length ? parts.join(" - ") : storeBranch.key;
}

function normalizeStoreAllocationQuantity(value, { allowZero = true } = {}) {
    return normalizePositiveStockQuantity(value, "So luong phan bo", { allowZero });
}

function localizeStoreAllocation(allocation) {
    if (!allocation) return null;

    return addVietnameseAliases(allocation, {
        product_id: "ma_san_pham",
        store_key: "ma_cua_hang",
        store_name: "ten_cua_hang",
        allocated_quantity: "so_luong_phan_bo",
        publish_mode: "trang_thai_niem_yet",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

function resolvePublishedAllocationQuantity(allocation) {
    if (!allocation) return 0;
    return allocation.publish_mode === "published"
        ? roundStockQuantity(allocation.allocated_quantity || 0)
        : 0;
}

function toPlainProduct(productInstance) {
    if (!productInstance) return null;

    const product = productInstance.get({ plain: true });
    const storeAllocations = Array.isArray(product.store_allocations)
        ? product.store_allocations.map((allocation) => ({
            ...allocation,
            allocated_quantity: roundStockQuantity(allocation.allocated_quantity || 0)
        }))
        : [];
    const hasStoreAllocations = storeAllocations.length > 0;
    const isPublishedByStore = storeAllocations.some((allocation) => resolvePublishedAllocationQuantity(allocation) > 0);
    const stockQuantity = roundStockQuantity(product.stock_quantity || 0);
    const stockUnit = resolveStockUnitValue(product);
    const saleUnit = resolveSaleUnitValue(product);
    const stockPerSaleUnit = getStockPerSaleUnit(product);
    const availableSaleQuantity = getAvailableSaleQuantity({
        stock_quantity: stockQuantity,
        stock_per_sale_unit: stockPerSaleUnit
    });
    const effectivePublished = hasStoreAllocations ? isPublishedByStore : Boolean(product.is_published);
    const isSellable = effectivePublished && product.status === "active" && hasRemainingWarehouseStock(product);

    return {
        ...product,
        stock_quantity: stockQuantity,
        stock_unit: stockUnit,
        sale_unit: saleUnit,
        stock_per_sale_unit: stockPerSaleUnit,
        unit: saleUnit,
        category_name: product.category ? product.category.name : null,
        images: product.images || [],
        reviews: product.reviews || [],
        store_allocations: storeAllocations,
        average_rating: Number(product.average_rating || 0),
        review_count: Number(product.review_count || 0),
        current_price: Number(product.current_price || product.sale_price || product.price || 0),
        available_sale_quantity: availableSaleQuantity,
        is_published: effectivePublished,
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
    const storeAllocations = (localized.store_allocations || []).map(localizeStoreAllocation);

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
            stock_unit: "don_vi_kho",
            stock_per_sale_unit: "so_luong_kho_moi_don_vi_ban",
            sale_unit: "don_vi_ban",
            available_sale_quantity: "so_don_vi_ban_con_lai",
            unit: "don_vi",
            production_date: "ngay_san_xuat",
            expiration_date: "ngay_het_han",
            thumbnail_url: "anh_dai_dien",
            is_featured: "san_pham_noi_bat",
            is_published: "dang_ban",
            is_sellable: "co_the_ban",
            status: "trang_thai_ma",
            status_label: "trang_thai_hien_thi",
            category_name: "ten_danh_muc",
            supplier_name: "ten_nha_cung_cap",
            average_rating: "diem_danh_gia_trung_binh",
            review_count: "tong_so_danh_gia",
            store_allocations: "phan_bo_cua_hang",
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
        danh_sach_danh_gia: reviews,
        store_allocations: storeAllocations,
        phan_bo_cua_hang: storeAllocations
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

        if (filters.category_slug) {
            const category = await Category.findOne({
                where: { slug: String(filters.category_slug).trim() },
                attributes: ["id"]
            });

            if (!category) {
                return {
                    items: [],
                    danh_sach_san_pham: [],
                    pagination: addVietnameseAliases({
                        page: 1,
                        limit: Math.min(Math.max(Number(filters.limit) || 12, 1), 100),
                        total: 0,
                        total_pages: 1
                    }, {
                        total_pages: "tong_so_trang"
                    })
                };
            }

            whereClauses.push({ category_id: category.id });
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
                },
                {
                    model: ProductStoreAllocation,
                    as: "store_allocations",
                    separate: true,
                    order: [["store_key", "ASC"], ["id", "ASC"]]
                }
            ],
            order: buildSortOrder(filters.sort_by),
            limit,
            offset,
            distinct: true
        });

        const items = rows
            .map((product) => toPlainProduct(product))
            .filter((product) => filters.in_stock === "true" ? Number(product.stock_quantity || 0) > 0 : true)
            .map(localizeProduct);

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
                    model: ProductStoreAllocation,
                    as: "store_allocations",
                    separate: true,
                    order: [["store_key", "ASC"], ["id", "ASC"]]
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
        const categoryId = await resolveCategoryIdInput(data);

        await sequelize.transaction(async (transaction) => {
            const requestedPublished = data.is_published === true || data.is_published === "true";
            const requestedStatus = data.status || null;
            const stockUnit = resolveStockUnitValue(data);
            const saleUnit = resolveSaleUnitValue(data);
            const stockPerSaleUnit = resolveStockPerSaleUnitValue(data, 1);
            const stockQuantity = normalizePositiveStockQuantity(data.stock_quantity || 0, "So luong ton");
            const generatedSlug = await generateUniqueProductSlug(data.name, data.slug, transaction);
            const generatedSku = await generateUniqueProductSku(data.name, data.sku, transaction);
            const normalizedState = normalizeProductState({
                stockQuantity,
                isPublished: requestedPublished,
                currentStatus: requestedStatus,
                stockPerSaleUnit
            });

            const product = await Product.create({
                category_id: categoryId,
                name: data.name,
                slug: generatedSlug,
                sku: generatedSku,
                short_description: data.short_description || null,
                description: data.description || null,
                price: data.price,
                sale_price: data.sale_price || null,
                stock_quantity: normalizedState.stock_quantity,
                stock_unit: stockUnit,
                stock_per_sale_unit: stockPerSaleUnit,
                sale_unit: saleUnit,
                unit: saleUnit,
                production_date: data.production_date || null,
                expiration_date: data.expiration_date || null,
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

        const categoryId = await resolveCategoryIdInput(data, { allowMissing: true });

        await sequelize.transaction(async (transaction) => {
            const updateData = {};

            PRODUCT_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    updateData[field] = data[field];
                }
            });

            if (categoryId !== null) {
                updateData.category_id = categoryId;
            }

            const mergedStockUnit = Object.prototype.hasOwnProperty.call(updateData, "stock_unit")
                ? resolveStockUnitValue(updateData, product.stock_unit)
                : resolveStockUnitValue(product, product.stock_unit);
            const mergedSaleUnit = Object.prototype.hasOwnProperty.call(updateData, "sale_unit")
                || Object.prototype.hasOwnProperty.call(updateData, "unit")
                ? resolveSaleUnitValue(updateData, product.sale_unit || product.unit || "don vi")
                : resolveSaleUnitValue(product, product.sale_unit || product.unit || "don vi");
            const mergedStockPerSaleUnit = Object.prototype.hasOwnProperty.call(updateData, "stock_per_sale_unit")
                ? resolveStockPerSaleUnitValue(updateData, product.stock_per_sale_unit || 1)
                : getStockPerSaleUnit(product);

            const mergedStock = Object.prototype.hasOwnProperty.call(updateData, "stock_quantity")
                ? normalizePositiveStockQuantity(updateData.stock_quantity, "So luong ton")
                : roundStockQuantity(product.stock_quantity);
            const mergedPublished = Object.prototype.hasOwnProperty.call(updateData, "is_published")
                ? (updateData.is_published === true || updateData.is_published === "true")
                : Boolean(product.is_published);
            const mergedStatus = Object.prototype.hasOwnProperty.call(updateData, "status")
                ? updateData.status
                : product.status;

            const normalizedState = normalizeProductState({
                stockQuantity: mergedStock,
                isPublished: mergedPublished,
                currentStatus: mergedStatus,
                stockPerSaleUnit: mergedStockPerSaleUnit
            });

            updateData.stock_unit = mergedStockUnit;
            updateData.sale_unit = mergedSaleUnit;
            updateData.stock_per_sale_unit = mergedStockPerSaleUnit;
            updateData.unit = mergedSaleUnit;
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

    async publish(id, data = {}) {
        const product = await Product.findByPk(id);
        if (!product) return null;

        const priceInput = normalizeOptionalPrice(data.price, "Gia ban");
        const salePriceInput = normalizeOptionalPrice(data.sale_price, "Gia khuyen mai");
        const updateData = {};

        if (priceInput.hasValue) {
            if (priceInput.value === null) {
                const error = new Error("Gia ban khong duoc de trong khi mo ban.");
                error.statusCode = 400;
                throw error;
            }

            updateData.price = priceInput.value;
        }

        if (salePriceInput.hasValue) {
            updateData.sale_price = salePriceInput.value;
        }

        const nextState = normalizeProductState({
            stockQuantity: product.stock_quantity,
            isPublished: true,
            currentStatus: product.status,
            stockPerSaleUnit: product.stock_per_sale_unit
        });

        await product.update({
            ...updateData,
            ...nextState
        });
        return this.getById(id);
    },

    async setStoreAllocation(id, data = {}) {
        const storeBranch = getStoreBranch(data.store_key);
        if (!storeBranch) {
            const error = new Error("Cửa hàng phân bổ không hợp lệ.");
            error.statusCode = 400;
            throw error;
        }

        const retailPrice = normalizeOptionalPrice(data.sale_price, "Gia ban le");
        const listingQuantity = resolveStockPerSaleUnitValue({ stock_per_sale_unit: data.stock_per_sale_unit ?? data.listing_quantity }, 1);
        const saleUnit = resolveSaleUnitValue({ sale_unit: data.sale_unit }, "đơn vị");
        const publishMode = data.publish_mode === "draft" ? "draft" : "published";
        const storeName = resolveStoreBranchName(storeBranch, data);
        const requestedQuantity = normalizeStoreAllocationQuantity(
            data.allocated_quantity ?? data.store_quantity ?? data.quantity ?? 0,
            { allowZero: publishMode !== "published" }
        );

        await sequelize.transaction(async (transaction) => {
            const product = await Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!product) {
                const error = new Error("Không tìm thấy sản phẩm.");
                error.statusCode = 404;
                throw error;
            }

            const existingAllocations = await ProductStoreAllocation.findAll({
                where: { product_id: id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const currentAllocation = existingAllocations.find((allocation) => allocation.store_key === storeBranch.key) || null;
            const previousAllocatedQuantity = roundStockQuantity(Number(currentAllocation?.allocated_quantity || 0));
            const nextAllocatedQuantity = requestedQuantity <= 0 && publishMode === "draft" ? 0 : requestedQuantity;
            const stockBefore = roundStockQuantity(product.stock_quantity || 0);
            const stockAfter = roundStockQuantity(stockBefore - (nextAllocatedQuantity - previousAllocatedQuantity));

            if (stockAfter < 0) {
                const error = new Error(`Kho tổng không đủ hàng để cấp ${requestedQuantity} cho ${storeBranch.label}.`);
                error.statusCode = 400;
                throw error;
            }

            if (currentAllocation) {
                if (requestedQuantity <= 0 && publishMode === "draft") {
                    await currentAllocation.destroy({ transaction });
                } else {
                    await currentAllocation.update({
                        store_name: storeName,
                        allocated_quantity: requestedQuantity,
                        publish_mode: publishMode
                    }, { transaction });
                }
            } else if (requestedQuantity > 0 || publishMode === "published") {
                await ProductStoreAllocation.create({
                    product_id: id,
                    store_key: storeBranch.key,
                    store_name: storeName,
                    allocated_quantity: requestedQuantity,
                    publish_mode: publishMode
                }, { transaction });
            }

            const nextAllocationRows = await ProductStoreAllocation.findAll({
                where: { product_id: id },
                transaction
            });
            const hasPublishedStore = nextAllocationRows.some((allocation) => resolvePublishedAllocationQuantity(allocation.get({ plain: true })) > 0);
            const nextState = normalizeProductState({
                stockQuantity: stockAfter,
                isPublished: hasPublishedStore,
                currentStatus: product.status,
                stockPerSaleUnit: listingQuantity
            });
            if (hasPublishedStore) nextState.status = "active";

            const updatePayload = {
                stock_quantity: nextState.stock_quantity,
                stock_unit: resolveStockUnitValue(product, product.stock_unit),
                sale_unit: saleUnit,
                unit: saleUnit,
                stock_per_sale_unit: listingQuantity,
                is_published: nextState.is_published,
                status: nextState.status
            };

            if (retailPrice.hasValue) {
                updatePayload.sale_price = retailPrice.value;
            }

            await product.update(updatePayload, { transaction });
        });

        return this.getById(id);
    },

    async unpublish(id, data = {}) {
        const storeKey = String(data.store_key || "").trim();

        await sequelize.transaction(async (transaction) => {
            const product = await Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!product) {
                const error = new Error("Không tìm thấy sản phẩm.");
                error.statusCode = 404;
                throw error;
            }

            const allocations = await ProductStoreAllocation.findAll({
                where: { product_id: id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const affectedAllocations = storeKey
                ? allocations.filter((allocation) => allocation.store_key === storeKey)
                : allocations;

            const returnedQuantity = affectedAllocations.reduce((sum, allocation) => sum + Number(allocation.allocated_quantity || 0), 0);

            if (storeKey) {
                await ProductStoreAllocation.destroy({
                    where: { product_id: id, store_key: storeKey },
                    transaction
                });
            } else {
                await ProductStoreAllocation.destroy({
                    where: { product_id: id },
                    transaction
                });
            }

            const stockAfter = roundStockQuantity(Number(product.stock_quantity || 0) + returnedQuantity);
            const remainingAllocations = storeKey
                ? allocations.filter((allocation) => allocation.store_key !== storeKey)
                : [];
            const hasPublishedStore = remainingAllocations.some((allocation) => resolvePublishedAllocationQuantity(allocation.get({ plain: true })) > 0);
            const nextState = normalizeProductState({
                stockQuantity: stockAfter,
                isPublished: hasPublishedStore,
                currentStatus: product.status === "archived" ? "archived" : "draft",
                stockPerSaleUnit: product.stock_per_sale_unit
            });
            if (hasPublishedStore) nextState.status = "active";

            await product.update(nextState, { transaction });
        });

        return this.getById(id);
    },

    async remove(id) {
        const deletedRows = await Product.destroy({ where: { id } });
        return deletedRows > 0;
    }
};

module.exports = ProductModel;
