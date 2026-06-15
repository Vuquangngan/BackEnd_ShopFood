const http = require("http");
const express = require("express");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const { DataTypes } = require("sequelize");
const swaggerUi = require("swagger-ui-express");

require("dotenv").config({ quiet: true });

const { sequelize } = require("./models");
const swaggerSpec = require("./docs/swagger");
const { withCommonResponseAliases } = require("./utils/responseHelpers");
const { initializeChatSocket } = require("./sockets/chatSocket");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const recipeCategoryRoutes = require("./routes/recipeCategoryRoutes");
const productRoutes = require("./routes/productRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const cartRoutes = require("./routes/cartRoutes");
const couponRoutes = require("./routes/couponRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const orderRoutes = require("./routes/orderRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const branchRoutes = require("./routes/branchRoutes");
const branchImportRequestRoutes = require("./routes/branchImportRequestRoutes");
const staffShiftRoutes = require("./routes/staffShiftRoutes");
const emailCampaignRoutes = require("./routes/emailCampaignRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = [
    "http://localhost:4173",
    "http://localhost:3000",
    "https://vuquangngan.github.io",
    "https://vuquangngan.github.io/BackEnd_ShopFood",
    "https://admin-foodifi.vercel.app",
    "https://fon-foodifi.vercel.app"
];

if (process.env.FRONTEND_ORIGINS) {
    allowedOrigins.push(
        ...process.env.FRONTEND_ORIGINS
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
    );
}

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/images/sanpham", express.static(path.resolve(__dirname, "..", "..", "Images", "sanpham")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "FOODIFI API Docs"
}));
app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "garden-fresh-api",
        timestamp: new Date().toISOString()
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/recipe-categories", recipeCategoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/branch-import-requests", branchImportRequestRoutes);
app.use("/api/staff-shifts", staffShiftRoutes);
app.use("/api/email-campaigns", emailCampaignRoutes);
app.use("/api/ai", aiRoutes);
app.use("/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
    res.send("API đang hoạt động. Truy cập /api-docs để xem tài liệu Swagger.");
});

app.use((req, res) => {
    res.status(404).json(withCommonResponseAliases({
        message: "Không tìm thấy đường dẫn yêu cầu."
    }));
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Dữ liệu JSON gửi lên không hợp lệ."
        }));
    }

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json(withCommonResponseAliases({
                message: `Kích thước ảnh vượt quá giới hạn ${process.env.UPLOAD_MAX_FILE_SIZE_MB || 5} MB.`
            }));
        }

        return res.status(400).json(withCommonResponseAliases({
            message: error.message || "Tệp tải lên không hợp lệ."
        }));
    }

    if (error && (error.status === 400 || error.statusCode === 400)) {
        return res.status(400).json(withCommonResponseAliases({
            message: error.message || "Yêu cầu không hợp lệ."
        }));
    }

    console.error("Lỗi ứng dụng:", error.message || error);

    return res.status(error.status || error.statusCode || 500).json(withCommonResponseAliases({
        message: "Đã xảy ra lỗi máy chủ."
    }));
});

const PORT = process.env.PORT || 3000;

function normalizeTableName(entry) {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") {
        return entry.tableName || entry.name || Object.values(entry)[0];
    }

    return String(entry);
}

async function ensureRuntimeSchema() {
    const queryInterface = sequelize.getQueryInterface();
    const userTable = await queryInterface.describeTable("users");

    if (!userTable.code) {
        await queryInterface.addColumn("users", "code", {
            type: DataTypes.STRING(50),
            allowNull: true,
            unique: true
        });
    }

    if (!userTable.must_change_password) {
        await queryInterface.addColumn("users", "must_change_password", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }

    const existingTables = (await queryInterface.showAllTables())
        .map(normalizeTableName)
        .map((tableName) => String(tableName).toLowerCase());

    if (!existingTables.includes("media_assets")) {
        await queryInterface.createTable("media_assets", {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            folder: {
                type: DataTypes.STRING(80),
                allowNull: false,
                defaultValue: "general"
            },
            original_name: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            file_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            mime_type: {
                type: DataTypes.STRING(120),
                allowNull: false
            },
            size: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0
            },
            data: {
                type: DataTypes.BLOB("long"),
                allowNull: false
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal("CURRENT_TIMESTAMP")
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal("CURRENT_TIMESTAMP")
            }
        });
        await queryInterface.addIndex("media_assets", ["folder"], {
            name: "media_assets_folder_idx"
        });
        await queryInterface.addIndex("media_assets", ["created_at"], {
            name: "media_assets_created_at_idx"
        });
    }

    if (!existingTables.includes("staff_shift_slots")) {
        await queryInterface.createTable("staff_shift_slots", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            branch_id: { type: DataTypes.STRING(80), allowNull: false },
            client_id: { type: DataTypes.STRING(80), allowNull: false },
            name: { type: DataTypes.STRING(120), allowNull: false },
            start_time: { type: DataTypes.STRING(10), allowNull: false },
            end_time: { type: DataTypes.STRING(10), allowNull: false },
            tone: { type: DataTypes.ENUM("morning", "afternoon", "evening"), allowNull: false, defaultValue: "morning" },
            enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            applies_to_date: { type: DataTypes.DATEONLY, allowNull: true },
            created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("staff_shift_slots", ["branch_id", "client_id"], {
            unique: true,
            name: "staff_shift_slots_branch_client_unique"
        });
        await queryInterface.addIndex("staff_shift_slots", ["branch_id", "enabled"], {
            name: "staff_shift_slots_branch_enabled_idx"
        });
    }

    if (!existingTables.includes("staff_shift_assignments")) {
        await queryInterface.createTable("staff_shift_assignments", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            branch_id: { type: DataTypes.STRING(80), allowNull: false },
            shift_slot_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
            employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
            shift_date: { type: DataTypes.DATEONLY, allowNull: false },
            status: { type: DataTypes.ENUM("pending", "confirmed"), allowNull: false, defaultValue: "pending" },
            source: { type: DataTypes.ENUM("self", "manager"), allowNull: false, defaultValue: "self" },
            registered_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
            registered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            confirmed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
            confirmed_at: { type: DataTypes.DATE, allowNull: true },
            confirmation_source: { type: DataTypes.STRING(40), allowNull: true },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("staff_shift_assignments", ["branch_id", "shift_slot_id", "shift_date", "employee_id"], {
            unique: true,
            name: "staff_shift_assignments_unique"
        });
        await queryInterface.addIndex("staff_shift_assignments", ["branch_id", "shift_date"], {
            name: "staff_shift_assignments_branch_date_idx"
        });
        await queryInterface.addIndex("staff_shift_assignments", ["employee_id", "shift_date"], {
            name: "staff_shift_assignments_employee_date_idx"
        });
    }

    if (!existingTables.includes("staff_shift_holidays")) {
        await queryInterface.createTable("staff_shift_holidays", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            branch_id: { type: DataTypes.STRING(80), allowNull: false },
            holiday_date: { type: DataTypes.DATEONLY, allowNull: false },
            note: { type: DataTypes.STRING(255), allowNull: true },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("staff_shift_holidays", ["branch_id", "holiday_date"], {
            unique: true,
            name: "staff_shift_holidays_branch_date_unique"
        });
    }

    if (!existingTables.includes("branches")) {
        await queryInterface.createTable("branches", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            label: { type: DataTypes.STRING(120), allowNull: false },
            name: { type: DataTypes.STRING(120), allowNull: false },
            manager: { type: DataTypes.STRING(120), allowNull: true },
            phone: { type: DataTypes.STRING(20), allowNull: true },
            city: { type: DataTypes.STRING(120), allowNull: true },
            address: { type: DataTypes.STRING(255), allowNull: true },
            hours: { type: DataTypes.STRING(50), allowNull: true },
            image_url: { type: DataTypes.TEXT, allowNull: true },
            status: { type: DataTypes.ENUM("active", "paused", "closed"), allowNull: false, defaultValue: "active" },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("branches", ["status"], { name: "branches_status_idx" });
        await queryInterface.addIndex("branches", ["city"], { name: "branches_city_idx" });
    }

    const [branchCountRows] = await sequelize.query("SELECT COUNT(*) AS total FROM branches");
    const branchCount = Number(branchCountRows?.[0]?.total || 0);
    if (branchCount === 0) {
        await queryInterface.bulkInsert("branches", [
            {
                key: "store_1",
                code: "CN-001",
                label: "FOODIFI 1",
                name: "FOODIFI 1",
                manager: "Trần Văn Lý",
                phone: "0906572167",
                city: "Hà Nội",
                address: "113 Cầu Giấy, Quận Cầu Giấy, Hà Nội",
                hours: "07:00 - 21:00",
                image_url: "",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                key: "store_2",
                code: "CN-002",
                label: "FOODIFI 2",
                name: "FOODIFI 2",
                manager: "Vũ Quang Ngân",
                phone: "0916837759",
                city: "Hà Nội",
                address: "80 Trần Phú, Quận Hà Đông, Hà Nội",
                hours: "06:00 - 22:00",
                image_url: "",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                key: "store_3",
                code: "CN-003",
                label: "FOODIFI 3",
                name: "FOODIFI 3",
                manager: "",
                phone: "",
                city: "Hà Nội",
                address: "",
                hours: "07:00 - 21:00",
                image_url: "",
                status: "active",
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    }

    if (!existingTables.includes("branch_import_requests")) {
        await queryInterface.createTable("branch_import_requests", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            branch_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: "branches", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            branch_key: { type: DataTypes.STRING(50), allowNull: false },
            branch_name: { type: DataTypes.STRING(180), allowNull: false },
            expected_date: { type: DataTypes.DATEONLY, allowNull: true },
            note: { type: DataTypes.TEXT, allowNull: true },
            status: {
                type: DataTypes.ENUM("draft", "pending", "approved", "receiving", "completed", "rejected"),
                allowNull: false,
                defaultValue: "pending"
            },
            status_note: { type: DataTypes.STRING(255), allowNull: true },
            created_by: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            approved_at: { type: DataTypes.DATE, allowNull: true },
            shipped_at: { type: DataTypes.DATE, allowNull: true },
            completed_at: { type: DataTypes.DATE, allowNull: true },
            rejected_at: { type: DataTypes.DATE, allowNull: true },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("branch_import_requests", ["branch_id"], { name: "branch_import_requests_branch_id_idx" });
        await queryInterface.addIndex("branch_import_requests", ["branch_key"], { name: "branch_import_requests_branch_key_idx" });
        await queryInterface.addIndex("branch_import_requests", ["status"], { name: "branch_import_requests_status_idx" });
        await queryInterface.addIndex("branch_import_requests", ["created_at"], { name: "branch_import_requests_created_at_idx" });
    }

    if (!existingTables.includes("branch_import_request_items")) {
        await queryInterface.createTable("branch_import_request_items", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            request_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: "branch_import_requests", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            product_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: "products", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT"
            },
            name: { type: DataTypes.STRING(180), allowNull: false },
            sku: { type: DataTypes.STRING(80), allowNull: true },
            thumbnail_url: { type: DataTypes.TEXT, allowNull: true },
            unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
            quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 1 },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("branch_import_request_items", ["request_id"], { name: "branch_import_request_items_request_id_idx" });
        await queryInterface.addIndex("branch_import_request_items", ["product_id"], { name: "branch_import_request_items_product_id_idx" });
    }

    if (existingTables.includes("categories")) {
        await queryInterface.changeColumn("categories", "image_url", {
            type: DataTypes.TEXT("medium"),
            allowNull: true
        });
    }

    if (!existingTables.includes("recipe_categories")) {
        await queryInterface.createTable("recipe_categories", {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false
            },
            slug: {
                type: DataTypes.STRING(150),
                allowNull: false,
                unique: true
            },
            description: {
                type: DataTypes.TEXT
            },
            image_url: {
                type: DataTypes.TEXT("medium")
            },
            color_hex: {
                type: DataTypes.STRING(20)
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal("CURRENT_TIMESTAMP")
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal("CURRENT_TIMESTAMP")
            }
        });
    }

    if (existingTables.includes("recipe_categories")) {
        await queryInterface.changeColumn("recipe_categories", "image_url", {
            type: DataTypes.TEXT("medium"),
            allowNull: true
        });
    }

    const recipeTable = await queryInterface.describeTable("recipes");
    if (!recipeTable.recipe_category_id) {
        await queryInterface.addColumn("recipes", "recipe_category_id", {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: {
                model: "recipe_categories",
                key: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
        });
    }

    const [categoryCountRows] = await sequelize.query("SELECT COUNT(*) AS total FROM recipe_categories");
    const categoryCount = Number(categoryCountRows?.[0]?.total || 0);
    if (categoryCount === 0) {
        await queryInterface.bulkInsert("recipe_categories", [
            {
                name: "Món Việt",
                slug: "mon-viet",
                description: "Các món ăn truyền thống quen thuộc.",
                color_hex: "#0E8A47",
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: "Món Âu",
                slug: "mon-au",
                description: "Các món ăn phong cách phương Tây.",
                color_hex: "#E28A2E",
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: "Healthy",
                slug: "healthy",
                description: "Món ăn lành mạnh và cân bằng dinh dưỡng.",
                color_hex: "#36C86E",
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: "Tráng miệng",
                slug: "trang-mieng",
                description: "Nhóm món ngọt và món ăn nhẹ cuối bữa.",
                color_hex: "#F6A977",
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    }

    const productTable = await queryInterface.describeTable("products");
    if (!productTable.stock_unit) {
        await queryInterface.addColumn("products", "stock_unit", {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "đơn vị"
        });
    }
    if (!productTable.sale_unit) {
        await queryInterface.addColumn("products", "sale_unit", {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "đơn vị"
        });
    }
    if (!productTable.stock_per_sale_unit) {
        await queryInterface.addColumn("products", "stock_per_sale_unit", {
            type: DataTypes.DECIMAL(12, 3),
            allowNull: false,
            defaultValue: 1
        });
    }
    if (!productTable.production_date) {
        await queryInterface.addColumn("products", "production_date", {
            type: DataTypes.DATEONLY,
            allowNull: true
        });
    }
    if (!productTable.expiration_date) {
        await queryInterface.addColumn("products", "expiration_date", {
            type: DataTypes.DATEONLY,
            allowNull: true
        });
    }
    if (productTable.thumbnail_url) {
        await queryInterface.changeColumn("products", "thumbnail_url", {
            type: DataTypes.TEXT,
            allowNull: true
        });
    }

    let productStoreAllocationTable = null;
    try {
        productStoreAllocationTable = await queryInterface.describeTable("product_store_allocations");
    } catch (_error) {
        await queryInterface.createTable("product_store_allocations", {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            product_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                references: {
                    model: "products",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            store_key: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            store_name: {
                type: DataTypes.STRING(120),
                allowNull: false
            },
            allocated_quantity: {
                type: DataTypes.DECIMAL(12, 3),
                allowNull: false,
                defaultValue: 0
            },
            publish_mode: {
                type: DataTypes.ENUM("draft", "published"),
                allowNull: false,
                defaultValue: "draft"
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });
        await queryInterface.addIndex("product_store_allocations", ["product_id", "store_key"], {
            unique: true,
            name: "product_store_allocations_product_id_store_key_unique"
        });
        await queryInterface.addIndex("product_store_allocations", ["store_key", "publish_mode"], {
            name: "product_store_allocations_store_key_publish_mode_idx"
        });
        productStoreAllocationTable = await queryInterface.describeTable("product_store_allocations");
    }

    if (productStoreAllocationTable && !productStoreAllocationTable.store_name) {
        await queryInterface.addColumn("product_store_allocations", "store_name", {
            type: DataTypes.STRING(120),
            allowNull: false,
            defaultValue: "Cửa hàng"
        });
    }
    if (productStoreAllocationTable && !productStoreAllocationTable.allocated_quantity) {
        await queryInterface.addColumn("product_store_allocations", "allocated_quantity", {
            type: DataTypes.DECIMAL(12, 3),
            allowNull: false,
            defaultValue: 0
        });
    }
    if (productStoreAllocationTable && !productStoreAllocationTable.publish_mode) {
        await queryInterface.addColumn("product_store_allocations", "publish_mode", {
            type: DataTypes.ENUM("draft", "published"),
            allowNull: false,
            defaultValue: "draft"
        });
    }

    const supplierTable = await queryInterface.describeTable("suppliers");
    if (!supplierTable.logo_url) {
        await queryInterface.addColumn("suppliers", "logo_url", {
            type: DataTypes.STRING(255),
            allowNull: true
        });
    }

    const orderTable = await queryInterface.describeTable("orders");
    if (!orderTable.shipped_at) {
        await queryInterface.addColumn("orders", "shipped_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.delivered_at) {
        await queryInterface.addColumn("orders", "delivered_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.completed_at) {
        await queryInterface.addColumn("orders", "completed_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.customer_received_at) {
        await queryInterface.addColumn("orders", "customer_received_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.shipping_provider) {
        await queryInterface.addColumn("orders", "shipping_provider", {
            type: DataTypes.STRING(50),
            allowNull: true
        });
    }
    if (!orderTable.tracking_code) {
        await queryInterface.addColumn("orders", "tracking_code", {
            type: DataTypes.STRING(80),
            allowNull: true
        });
    }
    if (!orderTable.shipping_status) {
        await queryInterface.addColumn("orders", "shipping_status", {
            type: DataTypes.STRING(50),
            allowNull: true
        });
    }
    if (!orderTable.shipping_note) {
        await queryInterface.addColumn("orders", "shipping_note", {
            type: DataTypes.STRING(255),
            allowNull: true
        });
    }
    if (!orderTable.shipping_estimated_minutes) {
        await queryInterface.addColumn("orders", "shipping_estimated_minutes", {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
        });
    }
    if (!orderTable.return_status) {
        await queryInterface.addColumn("orders", "return_status", {
            type: DataTypes.STRING(30),
            allowNull: true
        });
    }
    if (!orderTable.return_started_at) {
        await queryInterface.addColumn("orders", "return_started_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.return_completed_at) {
        await queryInterface.addColumn("orders", "return_completed_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
    if (!orderTable.refund_status) {
        await queryInterface.addColumn("orders", "refund_status", {
            type: DataTypes.STRING(30),
            allowNull: true
        });
    }
    if (!orderTable.refund_amount) {
        await queryInterface.addColumn("orders", "refund_amount", {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0
        });
    }
    if (!orderTable.refund_reason) {
        await queryInterface.addColumn("orders", "refund_reason", {
            type: DataTypes.TEXT,
            allowNull: true
        });
    }
    if (!orderTable.refunded_at) {
        await queryInterface.addColumn("orders", "refunded_at", {
            type: DataTypes.DATE,
            allowNull: true
        });
    }

    await sequelize.query(`
        UPDATE orders
        SET shipped_at = updated_at
        WHERE status = 'shipping' AND shipped_at IS NULL
    `);

    await sequelize.query(`
        UPDATE orders
        SET delivered_at = completed_at
        WHERE status = 'completed' AND completed_at IS NOT NULL AND delivered_at IS NULL
    `);

    await sequelize.query(`
        UPDATE orders
        SET
            status = 'shipping',
            delivered_at = COALESCE(delivered_at, completed_at, updated_at),
            completed_at = NULL
        WHERE
            status = 'completed'
            AND customer_received_at IS NULL
            AND return_status IS NULL
    `);

    await sequelize.query(`
        UPDATE orders
        SET completed_at = updated_at
        WHERE status = 'completed' AND completed_at IS NULL
    `);

    await queryInterface.changeColumn("products", "stock_quantity", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
    });

    await sequelize.query("UPDATE products SET stock_unit = COALESCE(stock_unit, 'đơn vị')");
    await sequelize.query("UPDATE products SET sale_unit = COALESCE(sale_unit, unit, 'đơn vị')");
    await sequelize.query("UPDATE products SET stock_per_sale_unit = COALESCE(stock_per_sale_unit, 1)");
    await sequelize.query("UPDATE products SET unit = COALESCE(sale_unit, unit, 'đơn vị')");

    const couponTable = await queryInterface.describeTable("coupons");
    if (!couponTable.campaign_metadata) {
        await queryInterface.addColumn("coupons", "campaign_metadata", {
            type: DataTypes.TEXT,
            allowNull: true
        });
    }

    if (!existingTables.includes("promotion_campaigns")) {
        await queryInterface.createTable("promotion_campaigns", {
            id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
            name: { type: DataTypes.STRING(160), allowNull: false },
            type: { type: DataTypes.ENUM("discount", "buy_x_get_y"), allowNull: false, defaultValue: "discount" },
            status: { type: DataTypes.ENUM("draft", "active", "paused", "expired"), allowNull: false, defaultValue: "active" },
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            apply_scope: { type: DataTypes.ENUM("products", "categories"), allowNull: false, defaultValue: "products" },
            apply_product_ids: { type: DataTypes.TEXT, allowNull: true },
            gift_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
            discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
            time_range: { type: DataTypes.STRING(120), allowNull: true },
            start_date: { type: DataTypes.DATE, allowNull: true },
            end_date: { type: DataTypes.DATE, allowNull: true },
            note: { type: DataTypes.TEXT, allowNull: true },
            created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
            created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
            updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") }
        });
        await queryInterface.addIndex("promotion_campaigns", ["type"], { name: "promotion_campaigns_type_idx" });
        await queryInterface.addIndex("promotion_campaigns", ["status"], { name: "promotion_campaigns_status_idx" });
        await queryInterface.addIndex("promotion_campaigns", ["is_active"], { name: "promotion_campaigns_is_active_idx" });
        await queryInterface.addIndex("promotion_campaigns", ["start_date", "end_date"], { name: "promotion_campaigns_date_idx" });
    }

    await queryInterface.changeColumn("inventory_documents", "total_quantity", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
    });
    await queryInterface.changeColumn("inventory_document_items", "quantity", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    });
    await queryInterface.changeColumn("inventory_transactions", "quantity", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    });
    await queryInterface.changeColumn("inventory_transactions", "stock_before", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    });
    await queryInterface.changeColumn("inventory_transactions", "stock_after", {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
    });

    const paymentTable = await queryInterface.describeTable("payment_transactions");
    if (!paymentTable.gateway_reference) {
        await queryInterface.addColumn("payment_transactions", "gateway_reference", {
            type: DataTypes.STRING(120),
            allowNull: true
        });
    }
    if (!paymentTable.gateway_checkout_url) {
        await queryInterface.addColumn("payment_transactions", "gateway_checkout_url", {
            type: DataTypes.TEXT,
            allowNull: true
        });
    }
}

async function startServer() {
    try {
        await sequelize.authenticate();
        const isHostedRuntime = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
        const shouldSyncOnStart = !isHostedRuntime && process.env.DB_SYNC_ON_START !== "false";
        if (shouldSyncOnStart) {
            await sequelize.sync({ alter: true });
        }
        await ensureRuntimeSchema();
        initializeChatSocket(httpServer);
        console.log("Kết nối Sequelize thành công.");

        httpServer.listen(PORT, () => {
            console.log(`Máy chủ đang chạy ở cổng ${PORT}.`);
            console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
            console.log(`Socket chat realtime đang sẵn sàng tại ws://localhost:${PORT}`);
        });
    } catch (error) {
        console.log("Kết nối cơ sở dữ liệu thất bại.");
        console.log(error.message || error);
        process.exit(1);
    }
}

startServer();





