const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
    sequelize,
    User,
    Category,
    Product,
    Recipe,
    RecipeIngredient,
    RecipeStep,
    Coupon
} = require("../models");

require("dotenv").config({ quiet: true });

const userSeeds = [
    {
        username: "Quáº£n trá»‹ há»‡ thá»‘ng",
        email: "vuquangngan312@gmail.com",
        legacy_emails: ["admin@shopfood.vn"],
        password: "ngan@312",
        phone: "0900000001",
        role: "admin",
        status: "active"
    },
    {
        username: "Quáº£n trá»‹ há»— trá»£",
        email: "nganhanoi312@gmail.com",
        password: "ngan@312",
        phone: "0900000003",
        role: "admin",
        status: "active"
    },
    {
        username: "KhÃ¡ch hÃ ng máº«u",
        email: "customer@shopfood.vn",
        password: "Customer@123456",
        phone: "0900000002",
        role: "customer",
        status: "active"
    }
];

const categorySeeds = [
    { name: "Thit heo", slug: "thit-heo", description: "Cac loai thit heo tuoi cho bua an hang ngay.", image_url: "/uploads/categories/danhmuc_thitheo.png", is_active: true },
    { name: "Thit bo", slug: "thit-bo", description: "Thit bo tuoi, thit bo cat san va cac phan bo pho bien.", image_url: "/uploads/categories/danhmuc_thibo.png", is_active: true },
    { name: "Thit ga", slug: "thit-ga", description: "Ga tuoi, ga lam san va cac phan thit ga tien che bien.", image_url: "/uploads/categories/danhmuc_thitga.png", is_active: true },
    { name: "Hai san", slug: "hai-san", description: "Hai san tuoi song va dong lanh cho bua an gia dinh.", image_url: "/uploads/categories/danhmuc_haisan.png", is_active: true },
    { name: "Rau la", slug: "rau-la", description: "Rau la xanh tuoi dung cho mon luoc, xao va salad.", image_url: "/uploads/categories/danhmuc_raula.png", is_active: true },
    { name: "Rau cu", slug: "rau-cu", description: "Rau cu tuoi, de bao quan va phu hop nhieu mon an.", image_url: "/uploads/categories/danhmuc_raucu.png", is_active: true },
    { name: "Trai cay", slug: "trai-cay", description: "Trai cay tuoi theo mua cho nhu cau an uong hang ngay.", image_url: "/uploads/categories/danhmuc_traicay.png", is_active: true },
    { name: "Mi tom", slug: "mi-tom", description: "Mi goi, thuc pham tien loi va do kho an lien.", image_url: "/uploads/categories/danhmuc_mitom.png", is_active: true },
    { name: "Sua", slug: "sua", description: "Sua tuoi, sua hop va cac san pham dinh duong tu sua.", image_url: "/uploads/categories/danhmuc_sua.png", is_active: true }
];

const legacyCategoryRemaps = {
    "thit-ca": "hai-san",
    "gia-vi": "mi-tom",
    "do-kho": "mi-tom"
};

const productSeeds = [
    { category_slug: "mi-tom", name: "Gao trang", slug: "gao-trang", sku: "SKU-GAO-001", short_description: "Gao trang thom deo", price: 22000, sale_price: 20000, stock_quantity: 150, unit: "kg", status: "active" },
    { category_slug: "thit-ga", name: "Trung ga", slug: "trung-ga", sku: "SKU-TRUNG-001", short_description: "Trung ga tuoi", price: 35000, sale_price: null, stock_quantity: 200, unit: "hop", status: "active" },
    { category_slug: "rau-la", name: "Hanh la", slug: "hanh-la", sku: "SKU-HANH-001", short_description: "Hanh la tuoi", price: 7000, sale_price: null, stock_quantity: 80, unit: "bo", status: "active" },
    { category_slug: "mi-tom", name: "Nuoc mam", slug: "nuoc-mam", sku: "SKU-NM-001", short_description: "Nuoc mam truyen thong", price: 18000, sale_price: null, stock_quantity: 60, unit: "chai", status: "active" },
    { category_slug: "mi-tom", name: "Dau an", slug: "dau-an", sku: "SKU-DAU-001", short_description: "Dau an tinh luyen", price: 42000, sale_price: null, stock_quantity: 50, unit: "chai", status: "active" },
    { category_slug: "thit-bo", name: "Thit bo", slug: "thit-bo", sku: "SKU-BO-001", short_description: "Thit bo tuoi", price: 180000, sale_price: 165000, stock_quantity: 40, unit: "kg", status: "active" },
    { category_slug: "rau-la", name: "Rau cai", slug: "rau-cai", sku: "SKU-RAU-001", short_description: "Rau cai xanh", price: 12000, sale_price: null, stock_quantity: 90, unit: "bo", status: "active" },
    { category_slug: "rau-cu", name: "Toi", slug: "toi", sku: "SKU-TOI-001", short_description: "Toi thom", price: 10000, sale_price: null, stock_quantity: 70, unit: "cu", status: "active" }
];

const couponSeeds = [
    {
        code: "GIAM10",
        description: "Giáº£m 10 pháº§n trÄƒm cho Ä‘Æ¡n tá»« 100 nghÃ¬n",
        discount_type: "percent",
        discount_value: 10,
        min_order_value: 100000,
        max_discount_value: 50000,
        usage_limit: 100,
        used_count: 0,
        is_active: true
    },
    {
        code: "FREESHIP15K",
        description: "Giáº£m 15 nghÃ¬n phÃ­ váº­n chuyá»ƒn cho Ä‘Æ¡n tá»« 150 nghÃ¬n",
        discount_type: "fixed",
        discount_value: 15000,
        min_order_value: 150000,
        max_discount_value: 15000,
        usage_limit: 50,
        used_count: 0,
        is_active: true
    }
];

const recipeSeeds = [
    {
        title: "CÆ¡m chiÃªn trá»©ng",
        slug: "com-chien-trung",
        description: "MÃ³n cÆ¡m chiÃªn nhanh gá»n, dÃ¹ng trá»±c tiáº¿p nguyÃªn liá»‡u trong cá»­a hÃ ng.",
        prep_time_minutes: 10,
        cook_time_minutes: 15,
        servings: 2,
        difficulty: "easy",
        calories: 450,
        status: "published",
        ingredients: [
            { product_slug: "gao-trang", ingredient_name: "Gáº¡o tráº¯ng", quantity: 0.5, unit: "kg", note: "Náº¥u cÆ¡m trÆ°á»›c khi chiÃªn", sort_order: 1 },
            { product_slug: "trung-ga", ingredient_name: "Trá»©ng gÃ ", quantity: 4, unit: "quáº£", sort_order: 2 },
            { product_slug: "hanh-la", ingredient_name: "HÃ nh lÃ¡", quantity: 1, unit: "bÃ³", note: "Cáº¯t nhá»", sort_order: 3 },
            { product_slug: "nuoc-mam", ingredient_name: "NÆ°á»›c máº¯m", quantity: 2, unit: "muá»—ng", sort_order: 4 },
            { product_slug: "dau-an", ingredient_name: "Dáº§u Äƒn", quantity: 2, unit: "muá»—ng", sort_order: 5 }
        ],
        steps: [
            { step_number: 1, instruction: "Náº¥u cÆ¡m chÃ­n rá»“i Ä‘á»ƒ nguá»™i trÆ°á»›c khi chiÃªn." },
            { step_number: 2, instruction: "ÄÃ¡nh tan trá»©ng, sau Ä‘Ã³ chiÃªn sÆ¡ vá»›i má»™t Ã­t dáº§u Äƒn." },
            { step_number: 3, instruction: "Cho cÆ¡m, nÆ°á»›c máº¯m vÃ  hÃ nh lÃ¡ vÃ o cháº£o, Ä‘áº£o Ä‘á»u tá»« 5 Ä‘áº¿n 7 phÃºt." },
            { step_number: 4, instruction: "DÃ¹ng khi cÃ²n nÃ³ng." }
        ]
    },
    {
        title: "BÃ² xÃ o rau cáº£i",
        slug: "bo-xao-rau-cai",
        description: "MÃ³n bÃ² xÃ o rau cáº£i Ä‘Æ¡n giáº£n, dá»… náº¥u cho bá»¯a cÆ¡m gia Ä‘Ã¬nh.",
        prep_time_minutes: 15,
        cook_time_minutes: 12,
        servings: 3,
        difficulty: "medium",
        calories: 380,
        status: "published",
        ingredients: [
            { product_slug: "thit-bo", ingredient_name: "Thá»‹t bÃ²", quantity: 0.4, unit: "kg", note: "ThÃ¡i lÃ¡t má»ng", sort_order: 1 },
            { product_slug: "rau-cai", ingredient_name: "Rau cáº£i", quantity: 2, unit: "bÃ³", note: "Rá»­a sáº¡ch vÃ  cáº¯t khÃºc", sort_order: 2 },
            { product_slug: "toi", ingredient_name: "Tá»i", quantity: 2, unit: "tÃ©p", note: "Äáº­p dáº­p nháº¹", sort_order: 3 },
            { product_slug: "dau-an", ingredient_name: "Dáº§u Äƒn", quantity: 1, unit: "muá»—ng", sort_order: 4 },
            { product_slug: "nuoc-mam", ingredient_name: "NÆ°á»›c máº¯m", quantity: 1, unit: "muá»—ng", sort_order: 5 }
        ],
        steps: [
            { step_number: 1, instruction: "Æ¯á»›p thá»‹t bÃ² vá»›i má»™t Ã­t nÆ°á»›c máº¯m trong 10 phÃºt." },
            { step_number: 2, instruction: "LÃ m nÃ³ng dáº§u, phi tá»i thÆ¡m rá»“i xÃ o nhanh thá»‹t bÃ² trÃªn lá»­a lá»›n." },
            { step_number: 3, instruction: "Cho rau cáº£i vÃ o vÃ  tiáº¿p tá»¥c Ä‘áº£o Ä‘áº¿n khi vá»«a chÃ­n tá»›i." },
            { step_number: 4, instruction: "NÃªm náº¿m láº¡i rá»“i dÃ¹ng khi cÃ²n nÃ³ng." }
        ]
    }
];

async function upsertBySlug(Model, payload, transaction) {
    const entity = await Model.findOne({
        where: { slug: payload.slug },
        transaction
    });

    if (entity) {
        await entity.update(payload, { transaction });
        return entity;
    }

    return Model.create(payload, { transaction });
}

async function upsertByEmail(payload, transaction) {
    const emailCandidates = [payload.email, ...(payload.legacy_emails || [])];

    const entity = await User.findOne({
        where: {
            email: {
                [Op.in]: emailCandidates
            }
        },
        transaction
    });

    const userPayload = {
        username: payload.username,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        role: payload.role,
        status: payload.status
    };

    if (entity) {
        await entity.update(userPayload, { transaction });
        return entity;
    }

    return User.create(userPayload, { transaction });
}

async function upsertCouponByCode(payload, transaction) {
    const entity = await Coupon.findOne({
        where: { code: payload.code },
        transaction
    });

    if (entity) {
        await entity.update(payload, { transaction });
        return entity;
    }

    return Coupon.create(payload, { transaction });
}

async function main() {
    try {
        await sequelize.authenticate();

        await sequelize.transaction(async (transaction) => {
            const usersByEmail = {};

            for (const userSeed of userSeeds) {
                const user = await upsertByEmail({
                    username: userSeed.username,
                    email: userSeed.email,
                    legacy_emails: userSeed.legacy_emails,
                    password: bcrypt.hashSync(userSeed.password, 10),
                    phone: userSeed.phone,
                    role: userSeed.role,
                    status: userSeed.status
                }, transaction);

                usersByEmail[user.email] = user;
            }

            const categoriesBySlug = {};

            for (const categorySeed of categorySeeds) {
                const category = await upsertBySlug(Category, categorySeed, transaction);
                categoriesBySlug[category.slug] = category;
            }

            for (const [legacySlug, replacementSlug] of Object.entries(legacyCategoryRemaps)) {
                const legacyCategory = await Category.findOne({
                    where: { slug: legacySlug },
                    transaction
                });

                const replacementCategory = categoriesBySlug[replacementSlug];

                if (!legacyCategory || !replacementCategory) {
                    continue;
                }

                await Product.update(
                    { category_id: replacementCategory.id },
                    {
                        where: { category_id: legacyCategory.id },
                        transaction
                    }
                );

                await legacyCategory.destroy({ transaction });
            }

            const productsBySlug = {};

            for (const productSeed of productSeeds) {
                const category = categoriesBySlug[productSeed.category_slug];

                const product = await upsertBySlug(Product, {
                    category_id: category.id,
                    name: productSeed.name,
                    slug: productSeed.slug,
                    sku: productSeed.sku,
                    short_description: productSeed.short_description,
                    price: productSeed.price,
                    sale_price: productSeed.sale_price,
                    stock_quantity: productSeed.stock_quantity,
                    unit: productSeed.unit,
                    status: productSeed.status,
                    is_published: true
                }, transaction);

                productsBySlug[product.slug] = product;
            }

            for (const couponSeed of couponSeeds) {
                await upsertCouponByCode(couponSeed, transaction);
            }

            const adminUser =
                usersByEmail["vuquangngan312@gmail.com"] ||
                usersByEmail["nganhanoi312@gmail.com"] ||
                null;

            for (const recipeSeed of recipeSeeds) {
                const recipe = await upsertBySlug(Recipe, {
                    author_id: adminUser ? adminUser.id : null,
                    title: recipeSeed.title,
                    slug: recipeSeed.slug,
                    description: recipeSeed.description,
                    prep_time_minutes: recipeSeed.prep_time_minutes,
                    cook_time_minutes: recipeSeed.cook_time_minutes,
                    servings: recipeSeed.servings,
                    difficulty: recipeSeed.difficulty,
                    calories: recipeSeed.calories,
                    status: recipeSeed.status
                }, transaction);

                await RecipeIngredient.destroy({
                    where: { recipe_id: recipe.id },
                    transaction
                });

                await RecipeStep.destroy({
                    where: { recipe_id: recipe.id },
                    transaction
                });

                await RecipeIngredient.bulkCreate(
                    recipeSeed.ingredients.map((ingredient) => ({
                        recipe_id: recipe.id,
                        product_id: productsBySlug[ingredient.product_slug]
                            ? productsBySlug[ingredient.product_slug].id
                            : null,
                        ingredient_name: ingredient.ingredient_name,
                        quantity: ingredient.quantity,
                        unit: ingredient.unit,
                        note: ingredient.note || null,
                        sort_order: ingredient.sort_order
                    })),
                    { transaction }
                );

                await RecipeStep.bulkCreate(
                    recipeSeed.steps.map((step) => ({
                        recipe_id: recipe.id,
                        step_number: step.step_number,
                        instruction: step.instruction,
                        image_url: step.image_url || null
                    })),
                    { transaction }
                );
            }
        });

        console.log(`Náº¡p dá»¯ liá»‡u máº«u ORM thÃ nh cÃ´ng cho cÆ¡ sá»Ÿ dá»¯ liá»‡u ${process.env.DB_NAME || "shopfood"}.`);
        console.log("TÃ i khoáº£n admin máº«u 1: vuquangngan312@gmail.com / ngan@312");
        console.log("TÃ i khoáº£n admin máº«u 2: nganhanoi312@gmail.com / ngan@312");
        console.log("TÃ i khoáº£n khÃ¡ch hÃ ng máº«u: customer@shopfood.vn / Customer@123456");
    } catch (error) {
        console.error("KhÃ´ng thá»ƒ náº¡p dá»¯ liá»‡u máº«u ORM.");
        console.error(error.message || error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();


