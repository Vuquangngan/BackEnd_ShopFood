const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
    sequelize,
    User,
    Category,
    Product,
    ProductStoreAllocation,
    ProductReview,
    Supplier,
    InventoryDocument,
    InventoryDocumentItem,
    InventoryTransaction,
    Coupon,
    Order,
    OrderItem,
    RecipeCategory,
    Recipe,
    RecipeIngredient,
    RecipeStep,
    ChatConversation,
    ChatMessage,
    Notification
} = require("../models");

require("dotenv").config({ quiet: true });

const PASSWORD_HASH = bcrypt.hashSync("ngan@312", 10);
const CUSTOMER_HASH = bcrypt.hashSync("Customer@123456", 10);

const users = [
    { username: "Quan tri he thong", email: "vuquangngan312@gmail.com", password: PASSWORD_HASH, phone: "0900000001", role: "admin", status: "active" },
    { username: "Quan tri ho tro", email: "nganhanoi312@gmail.com", password: PASSWORD_HASH, phone: "0900000003", role: "admin", status: "active" },
    { username: "Nhan vien ban hang", email: "staff@shopfood.vn", password: PASSWORD_HASH, phone: "0900000004", role: "staff", status: "active" },
    { username: "Nguyen Van An", email: "customer@shopfood.vn", password: CUSTOMER_HASH, phone: "0912000001", role: "customer", status: "active" },
    { username: "Tran Minh Thu", email: "thu@example.com", password: CUSTOMER_HASH, phone: "0912000002", role: "customer", status: "active" },
    { username: "Le Hoang Nam", email: "nam@example.com", password: CUSTOMER_HASH, phone: "0912000003", role: "customer", status: "active" },
    { username: "Pham Gia Han", email: "han@example.com", password: CUSTOMER_HASH, phone: "0912000004", role: "customer", status: "active" },
    { username: "Vo Thanh Dat", email: "dat@example.com", password: CUSTOMER_HASH, phone: "0912000005", role: "customer", status: "active" }
];

const categories = [
    { name: "Thit heo", slug: "thit-heo", description: "Thit heo tuoi cho bua an gia dinh.", image_url: "/uploads/categories/danhmuc_thitheo.png" },
    { name: "Thit bo", slug: "thit-bo", description: "Thit bo tuoi va cac phan bo pho bien.", image_url: "/uploads/categories/danhmuc_thibo.png" },
    { name: "Thit ga", slug: "thit-ga", description: "Ga tuoi, ga lam san va cac phan thit ga.", image_url: "/uploads/categories/danhmuc_thitga.png" },
    { name: "Hai san", slug: "hai-san", description: "Hai san tuoi song va dong lanh.", image_url: "/uploads/categories/danhmuc_haisan.png" },
    { name: "Rau la", slug: "rau-la", description: "Rau la xanh tuoi cho mon luoc, xao va salad.", image_url: "/uploads/categories/danhmuc_raula.png" },
    { name: "Rau cu", slug: "rau-cu", description: "Rau cu tuoi, de bao quan va che bien.", image_url: "/uploads/categories/danhmuc_raucu.png" },
    { name: "Trai cay", slug: "trai-cay", description: "Trai cay tuoi theo mua.", image_url: "/uploads/categories/danhmuc_traicay.png" },
    { name: "Do kho", slug: "do-kho", description: "Do kho, gia vi va thuc pham tien loi.", image_url: "/uploads/categories/danhmuc_mitom.png" },
    { name: "Sua va trung", slug: "sua-va-trung", description: "Sua, trung va san pham dinh duong.", image_url: "/uploads/categories/danhmuc_sua.png" }
];

const products = [
    ["thit-heo", "Thit ba chi heo", "thit-ba-chi-heo", "SKU-HEO-001", 125000, 115000, 48, "kg"],
    ["thit-heo", "Suon non heo", "suon-non-heo", "SKU-HEO-002", 145000, null, 35, "kg"],
    ["thit-heo", "Chan gio heo", "chan-gio-heo", "SKU-HEO-003", 98000, 89000, 22, "kg"],
    ["thit-bo", "Thit bo uc", "thit-bo-uc", "SKU-BO-001", 185000, 169000, 28, "kg"],
    ["thit-bo", "Bap bo tuoi", "bap-bo-tuoi", "SKU-BO-002", 210000, null, 18, "kg"],
    ["thit-bo", "Bo xay", "bo-xay", "SKU-BO-003", 165000, 149000, 25, "kg"],
    ["thit-ga", "Uc ga phi le", "uc-ga-phi-le", "SKU-GA-001", 82000, 76000, 55, "kg"],
    ["thit-ga", "Dui ga goc tu", "dui-ga-goc-tu", "SKU-GA-002", 78000, null, 42, "kg"],
    ["thit-ga", "Trung ga hop 10 qua", "trung-ga-hop-10-qua", "SKU-TRUNG-001", 35000, 32000, 120, "hop"],
    ["hai-san", "Ca hoi phi le", "ca-hoi-phi-le", "SKU-HS-001", 320000, 299000, 16, "kg"],
    ["hai-san", "Tom su tuoi", "tom-su-tuoi", "SKU-HS-002", 260000, 239000, 20, "kg"],
    ["hai-san", "Muc ong", "muc-ong", "SKU-HS-003", 210000, null, 14, "kg"],
    ["rau-la", "Rau cai xanh", "rau-cai-xanh", "SKU-RAU-001", 14000, null, 90, "bo"],
    ["rau-la", "Xa lach thuy canh", "xa-lach-thuy-canh", "SKU-RAU-002", 18000, 15000, 75, "bo"],
    ["rau-la", "Hanh la", "hanh-la", "SKU-RAU-003", 7000, null, 110, "bo"],
    ["rau-cu", "Ca rot Da Lat", "ca-rot-da-lat", "SKU-CU-001", 24000, 21000, 95, "kg"],
    ["rau-cu", "Khoai tay", "khoai-tay", "SKU-CU-002", 26000, null, 88, "kg"],
    ["rau-cu", "Toi Ly Son", "toi-ly-son", "SKU-CU-003", 65000, 59000, 45, "kg"],
    ["trai-cay", "Tao Envy", "tao-envy", "SKU-TC-001", 125000, 109000, 60, "kg"],
    ["trai-cay", "Cam sanh", "cam-sanh", "SKU-TC-002", 42000, null, 80, "kg"],
    ["trai-cay", "Chuoi cau", "chuoi-cau", "SKU-TC-003", 28000, 25000, 100, "kg"],
    ["do-kho", "Gao ST25", "gao-st25", "SKU-DK-001", 39000, 36000, 180, "kg"],
    ["do-kho", "Nuoc mam truyen thong", "nuoc-mam-truyen-thong", "SKU-DK-002", 48000, null, 75, "chai"],
    ["do-kho", "Dau an huong duong", "dau-an-huong-duong", "SKU-DK-003", 62000, 58000, 65, "chai"],
    ["sua-va-trung", "Sua tuoi khong duong", "sua-tuoi-khong-duong", "SKU-SUA-001", 34000, null, 95, "hop"],
    ["sua-va-trung", "Sua chua Hy Lap", "sua-chua-hy-lap", "SKU-SUA-002", 29000, 26000, 70, "hop"]
].map(([category_slug, name, slug, sku, price, sale_price, stock_quantity, unit]) => ({
    category_slug,
    name,
    slug,
    sku,
    short_description: `${name} chat luong cao, phu hop cho bua an hang ngay.`,
    description: `${name} duoc chon loc tu nha cung cap uy tin, bao quan dung quy trinh va giao nhanh trong ngay.`,
    price,
    sale_price,
    stock_quantity,
    stock_unit: unit,
    sale_unit: unit,
    unit,
    stock_per_sale_unit: 1,
    status: stock_quantity <= 10 ? "out_of_stock" : "active",
    is_published: true
}));

const suppliers = [
    { name: "Nong San Xanh Da Lat", code: "SUP-DALAT", contact_person: "Nguyen Thi Mai", phone: "02873000001", email: "dalat@shopfood.vn", address: "Da Lat, Lam Dong" },
    { name: "Hai San Bien Dong", code: "SUP-BIENDONG", contact_person: "Tran Quoc Bao", phone: "02873000002", email: "biendong@shopfood.vn", address: "Nha Trang, Khanh Hoa" },
    { name: "Trang Trai An Phu", code: "SUP-ANPHU", contact_person: "Le Van Phuc", phone: "02873000003", email: "anphu@shopfood.vn", address: "Cu Chi, TP HCM" },
    { name: "Thuc Pham Hoa Binh", code: "SUP-HOABINH", contact_person: "Pham Minh Khang", phone: "02873000004", email: "hoabinh@shopfood.vn", address: "Quan 7, TP HCM" }
];

const coupons = [
    { code: "GIAM10", description: "Giam 10 phan tram cho don tu 100 nghin", discount_type: "percent", discount_value: 10, min_order_value: 100000, max_discount_value: 50000, usage_limit: 100, used_count: 12, is_active: true },
    { code: "FREESHIP15K", description: "Giam 15 nghin phi van chuyen cho don tu 150 nghin", discount_type: "fixed", discount_value: 15000, min_order_value: 150000, max_discount_value: 15000, usage_limit: 50, used_count: 8, is_active: true },
    { code: "COMBO25", description: "Giam 25 nghin cho combo gia dinh", discount_type: "fixed", discount_value: 25000, min_order_value: 250000, max_discount_value: 25000, usage_limit: 80, used_count: 18, is_active: true },
    { code: "VIP15", description: "Giam 15 phan tram cho khach hang than thiet", discount_type: "percent", discount_value: 15, min_order_value: 300000, max_discount_value: 70000, usage_limit: 40, used_count: 5, is_active: true }
];

const recipeCategories = [
    { name: "Mon Viet", slug: "mon-viet", description: "Cac mon an gia dinh quen thuoc.", color_hex: "#0E8A47" },
    { name: "Mon Au", slug: "mon-au", description: "Cong thuc phong cach phuong Tay.", color_hex: "#E28A2E" },
    { name: "Healthy", slug: "healthy", description: "Bua an lanh manh va can bang.", color_hex: "#36C86E" },
    { name: "Trang mieng", slug: "trang-mieng", description: "Mon ngot va an nhe.", color_hex: "#F6A977" }
];

const recipes = [
    { category_slug: "mon-viet", title: "Com chien trung", slug: "com-chien-trung", description: "Mon com chien nhanh gon cho bua trua.", prep_time_minutes: 10, cook_time_minutes: 15, servings: 2, difficulty: "easy", calories: 450 },
    { category_slug: "mon-viet", title: "Bo xao rau cai", slug: "bo-xao-rau-cai", description: "Bo xao rau cai dam vi, de nau.", prep_time_minutes: 15, cook_time_minutes: 12, servings: 3, difficulty: "medium", calories: 380 },
    { category_slug: "healthy", title: "Salad ca hoi", slug: "salad-ca-hoi", description: "Salad ca hoi tuoi ket hop rau xanh.", prep_time_minutes: 20, cook_time_minutes: 5, servings: 2, difficulty: "easy", calories: 320 },
    { category_slug: "mon-viet", title: "Ga ap chao mat ong", slug: "ga-ap-chao-mat-ong", description: "Uc ga ap chao mem, an kem rau cu.", prep_time_minutes: 20, cook_time_minutes: 18, servings: 3, difficulty: "medium", calories: 410 }
];

function daysAgo(days) {
    const value = new Date();
    value.setDate(value.getDate() - days);
    return value;
}

async function upsert(Model, where, payload, transaction) {
    const entity = await Model.findOne({ where, transaction });
    if (entity) {
        await entity.update(payload, { transaction });
        return entity;
    }
    return Model.create(payload, { transaction });
}

async function main() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: true });

        await sequelize.transaction(async (transaction) => {
            const usersByEmail = {};
            for (const user of users) {
                usersByEmail[user.email] = await upsert(User, { email: user.email }, user, transaction);
            }

            const categoriesBySlug = {};
            for (const category of categories) {
                categoriesBySlug[category.slug] = await upsert(Category, { slug: category.slug }, {
                    ...category,
                    is_active: true
                }, transaction);
            }

            const productsBySlug = {};
            for (const product of products) {
                const category = categoriesBySlug[product.category_slug];
                productsBySlug[product.slug] = await upsert(Product, { slug: product.slug }, {
                    category_id: category.id,
                    name: product.name,
                    slug: product.slug,
                    sku: product.sku,
                    short_description: product.short_description,
                    description: product.description,
                    price: product.price,
                    sale_price: product.sale_price,
                    stock_quantity: product.stock_quantity,
                    stock_unit: product.stock_unit,
                    sale_unit: product.sale_unit,
                    unit: product.unit,
                    stock_per_sale_unit: product.stock_per_sale_unit,
                    status: product.status,
                    is_published: product.is_published
                }, transaction);
            }

            const suppliersByCode = {};
            for (const supplier of suppliers) {
                suppliersByCode[supplier.code] = await upsert(Supplier, { code: supplier.code }, {
                    ...supplier,
                    status: "active",
                    note: "Nha cung cap demo cho do an."
                }, transaction);
            }

            for (const coupon of coupons) {
                await upsert(Coupon, { code: coupon.code }, coupon, transaction);
            }

            const admin = usersByEmail["vuquangngan312@gmail.com"];
            const staff = usersByEmail["staff@shopfood.vn"];
            const customers = Object.values(usersByEmail).filter((user) => user.role === "customer");
            const productList = Object.values(productsBySlug);
            const supplierList = Object.values(suppliersByCode);

            for (let index = 0; index < productList.length; index += 1) {
                const product = productList[index];
                await upsert(ProductStoreAllocation, {
                    product_id: product.id,
                    store_key: "store_1"
                }, {
                    product_id: product.id,
                    store_key: "store_1",
                    store_name: "Chi nhanh trung tam",
                    allocated_quantity: Math.max(4, Math.floor(Number(product.stock_quantity || 0) * 0.35)),
                    publish_mode: "published"
                }, transaction);

                if (index % 2 === 0) {
                    await upsert(ProductStoreAllocation, {
                        product_id: product.id,
                        store_key: "store_2"
                    }, {
                        product_id: product.id,
                        store_key: "store_2",
                        store_name: "Chi nhanh phia Dong",
                        allocated_quantity: Math.max(2, Math.floor(Number(product.stock_quantity || 0) * 0.2)),
                        publish_mode: "published"
                    }, transaction);
                }
            }

            for (let index = 0; index < supplierList.length; index += 1) {
                const supplier = supplierList[index];
                const doc = await upsert(InventoryDocument, { code: `PN-DEMO-${index + 1}` }, {
                    code: `PN-DEMO-${index + 1}`,
                    type: "receipt",
                    supplier_id: supplier.id,
                    created_by: admin.id,
                    approved_by: staff.id,
                    reference_number: `REF-DEMO-${index + 1}`,
                    note: "Phieu nhap demo.",
                    status: "completed",
                    total_quantity: 0,
                    total_amount: 0,
                    completed_at: daysAgo(12 - index)
                }, transaction);

                const selectedProducts = productList.slice(index * 6, index * 6 + 8);
                let totalQuantity = 0;
                let totalAmount = 0;
                await InventoryDocumentItem.destroy({ where: { document_id: doc.id }, transaction });
                for (const product of selectedProducts) {
                    const quantity = Math.max(10, Math.floor(Number(product.stock_quantity || 0) / 2));
                    const unitCost = Math.round(Number(product.price || 0) * 0.72);
                    totalQuantity += quantity;
                    totalAmount += quantity * unitCost;
                    await InventoryDocumentItem.create({
                        document_id: doc.id,
                        product_id: product.id,
                        quantity,
                        unit_cost: unitCost,
                        line_total: quantity * unitCost,
                        note: "Hang demo"
                    }, { transaction });
                    await upsert(InventoryTransaction, {
                        product_id: product.id,
                        document_id: doc.id,
                        movement_type: "receipt"
                    }, {
                        product_id: product.id,
                        document_id: doc.id,
                        reference_type: "inventory_document",
                        reference_id: doc.id,
                        movement_type: "receipt",
                        direction: "in",
                        quantity,
                        stock_before: Math.max(0, Number(product.stock_quantity || 0) - quantity),
                        stock_after: Number(product.stock_quantity || 0),
                        unit_cost: unitCost,
                        note: "Nhap kho demo",
                        created_by: admin.id
                    }, transaction);
                }
                await doc.update({ total_quantity: totalQuantity, total_amount: totalAmount }, { transaction });
            }

            const orderStatuses = ["pending", "confirmed", "preparing", "shipping", "completed", "cancelled", "completed", "shipping", "pending", "completed", "confirmed", "completed"];
            for (let index = 0; index < orderStatuses.length; index += 1) {
                const customer = customers[index % customers.length];
                const status = orderStatuses[index];
                const code = `ORD-DEMO-${String(index + 1).padStart(3, "0")}`;
                const orderProducts = [
                    productList[index % productList.length],
                    productList[(index + 5) % productList.length],
                    productList[(index + 11) % productList.length]
                ];
                const items = orderProducts.map((product, itemIndex) => {
                    const quantity = itemIndex + 1;
                    const unitPrice = Number(product.sale_price || product.price || 0);
                    return {
                        product_id: product.id,
                        product_name: product.name,
                        unit_price: unitPrice,
                        quantity,
                        line_total: unitPrice * quantity
                    };
                });
                const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
                const shippingFee = subtotal >= 250000 ? 0 : 15000;
                const discountAmount = index % 3 === 0 ? 10000 : 0;
                const totalAmount = Math.max(subtotal + shippingFee - discountAmount, 0);
                const createdAt = daysAgo(index + 1);
                const order = await upsert(Order, { order_code: code }, {
                    order_code: code,
                    user_id: customer.id,
                    coupon_id: null,
                    customer_name: customer.username,
                    customer_phone: customer.phone,
                    shipping_address: `${12 + index} Duong Demo`,
                    ward: "Phuong 1",
                    district: "Quan 1",
                    city: "TP HCM",
                    note: index % 2 === 0 ? "Giao gio hanh chinh" : null,
                    payment_method: index % 4 === 0 ? "online" : "cod",
                    payment_status: ["completed", "shipping"].includes(status) ? "paid" : "unpaid",
                    status,
                    shipped_at: ["shipping", "completed"].includes(status) ? daysAgo(index) : null,
                    delivered_at: status === "completed" ? daysAgo(Math.max(index - 1, 0)) : null,
                    completed_at: status === "completed" ? daysAgo(Math.max(index - 1, 0)) : null,
                    customer_received_at: status === "completed" ? daysAgo(Math.max(index - 1, 0)) : null,
                    shipping_provider: status === "shipping" ? "grab_dev" : null,
                    tracking_code: status === "shipping" ? `GRAB-DEMO-${index + 1}` : null,
                    shipping_status: status === "shipping" ? "delivering" : null,
                    shipping_note: status === "shipping" ? "Tai xe dang giao hang" : null,
                    shipping_estimated_minutes: status === "shipping" ? 35 : null,
                    subtotal,
                    shipping_fee: shippingFee,
                    discount_amount: discountAmount,
                    total_amount: totalAmount,
                    created_at: createdAt,
                    updated_at: createdAt
                }, transaction);

                await OrderItem.destroy({ where: { order_id: order.id }, transaction });
                await OrderItem.bulkCreate(items.map((item) => ({ ...item, order_id: order.id })), { transaction });
            }

            for (let index = 0; index < Math.min(productList.length, 12); index += 1) {
                const product = productList[index];
                const customer = customers[index % customers.length];
                await upsert(ProductReview, {
                    product_id: product.id,
                    user_id: customer.id
                }, {
                    product_id: product.id,
                    user_id: customer.id,
                    rating: 4 + (index % 2),
                    comment: index % 2 === 0 ? "San pham tuoi, giao nhanh." : "Dong goi can than, chat luong tot."
                }, transaction);
            }

            const recipeCategoriesBySlug = {};
            for (const recipeCategory of recipeCategories) {
                recipeCategoriesBySlug[recipeCategory.slug] = await upsert(RecipeCategory, { slug: recipeCategory.slug }, {
                    ...recipeCategory,
                    is_active: true
                }, transaction);
            }

            for (const recipeSeed of recipes) {
                const recipe = await upsert(Recipe, { slug: recipeSeed.slug }, {
                    author_id: admin.id,
                    recipe_category_id: recipeCategoriesBySlug[recipeSeed.category_slug].id,
                    title: recipeSeed.title,
                    slug: recipeSeed.slug,
                    description: recipeSeed.description,
                    prep_time_minutes: recipeSeed.prep_time_minutes,
                    cook_time_minutes: recipeSeed.cook_time_minutes,
                    servings: recipeSeed.servings,
                    difficulty: recipeSeed.difficulty,
                    calories: recipeSeed.calories,
                    status: "published"
                }, transaction);

                await RecipeIngredient.destroy({ where: { recipe_id: recipe.id }, transaction });
                await RecipeStep.destroy({ where: { recipe_id: recipe.id }, transaction });
                await RecipeIngredient.bulkCreate([
                    { recipe_id: recipe.id, product_id: productList[0].id, ingredient_name: productList[0].name, quantity: 0.5, unit: "kg", sort_order: 1 },
                    { recipe_id: recipe.id, product_id: productList[12].id, ingredient_name: productList[12].name, quantity: 1, unit: "bo", sort_order: 2 }
                ], { transaction });
                await RecipeStep.bulkCreate([
                    { recipe_id: recipe.id, step_number: 1, instruction: "So che nguyen lieu va de rao." },
                    { recipe_id: recipe.id, step_number: 2, instruction: "Che bien theo lua vua den khi chin." },
                    { recipe_id: recipe.id, step_number: 3, instruction: "Trinh bay va dung khi con nong." }
                ], { transaction });
            }

            for (let index = 0; index < customers.length; index += 1) {
                const customer = customers[index];
                const conversation = await upsert(ChatConversation, { customer_id: customer.id }, {
                    customer_id: customer.id,
                    assigned_staff_id: staff.id,
                    subject: index % 2 === 0 ? "Hoi ve don hang" : "Tu van san pham",
                    status: index % 3 === 0 ? "closed" : "open",
                    last_message_preview: "Shop da tiep nhan yeu cau cua ban.",
                    last_message_at: daysAgo(index)
                }, transaction);

                await ChatMessage.destroy({ where: { conversation_id: conversation.id }, transaction });
                await ChatMessage.bulkCreate([
                    { conversation_id: conversation.id, sender_id: customer.id, sender_role: "customer", message_type: "text", content: "Shop oi minh can ho tro.", is_read: true },
                    { conversation_id: conversation.id, sender_id: staff.id, sender_role: "staff", message_type: "text", content: "Shop da tiep nhan va se xu ly ngay.", is_read: index % 2 === 0 }
                ], { transaction });
            }

            await Notification.destroy({ where: { user_id: { [Op.in]: [admin.id, staff.id] } }, transaction });
            await Notification.bulkCreate([
                { user_id: admin.id, type: "order", title: "Don hang moi", message: "Co don hang demo moi can xu ly.", is_read: false },
                { user_id: admin.id, type: "inventory", title: "Canh bao ton kho", message: "Mot so san pham sap het hang.", is_read: false },
                { user_id: staff.id, type: "chat", title: "Tin nhan moi", message: "Khach hang can ho tro ve don hang.", is_read: false }
            ], { transaction });
        });

        console.log("Seed demo thanh cong.");
        console.log("Admin: vuquangngan312@gmail.com / ngan@312");
        console.log("Customer: customer@shopfood.vn / Customer@123456");
    } catch (error) {
        console.error("Seed demo that bai.");
        console.error(error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
