const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const commonOptions = {
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
};

const User = sequelize.define("User", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(50), unique: true },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    phone: { type: DataTypes.STRING(20) },
    avatar_url: { type: DataTypes.STRING(255) },
    role: {
        type: DataTypes.ENUM("admin", "staff", "customer"),
        allowNull: false,
        defaultValue: "customer"
    },
    status: {
        type: DataTypes.ENUM("active", "inactive", "blocked"),
        allowNull: false,
        defaultValue: "active"
    }
}, {
    ...commonOptions,
    tableName: "users"
});

const UserAddress = sequelize.define("UserAddress", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    full_name: { type: DataTypes.STRING(120), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    address_line: { type: DataTypes.STRING(255), allowNull: false },
    ward: { type: DataTypes.STRING(120) },
    district: { type: DataTypes.STRING(120) },
    city: { type: DataTypes.STRING(120), allowNull: false },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
    ...commonOptions,
    tableName: "user_addresses"
});

const RefreshToken = sequelize.define("RefreshToken", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    token_hash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    device_name: { type: DataTypes.STRING(120) },
    ip_address: { type: DataTypes.STRING(60) },
    user_agent: { type: DataTypes.STRING(255) },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "refresh_tokens",
    indexes: [
        { fields: ["user_id"] },
        { fields: ["expires_at"] },
        { fields: ["revoked_at"] }
    ]
});

const Notification = sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(180), allowNull: false },
    message: { type: DataTypes.STRING(255), allowNull: false },
    metadata: { type: DataTypes.JSON },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "notifications",
    indexes: [
        { fields: ["user_id", "is_read"] },
        { fields: ["type"] },
        { fields: ["created_at"] }
    ]
});

const MediaAsset = sequelize.define("MediaAsset", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    folder: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "general" },
    original_name: { type: DataTypes.STRING(255) },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    mime_type: { type: DataTypes.STRING(120), allowNull: false },
    size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    data: { type: DataTypes.BLOB("long"), allowNull: false }
}, {
    ...commonOptions,
    tableName: "media_assets",
    indexes: [
        { fields: ["folder"] },
        { fields: ["created_at"] }
    ]
});

const Category = sequelize.define("Category", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    parent_id: { type: DataTypes.INTEGER.UNSIGNED },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
    image_url: { type: DataTypes.TEXT("medium") },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    ...commonOptions,
    tableName: "categories"
});

const RecipeCategory = sequelize.define("RecipeCategory", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
    image_url: { type: DataTypes.TEXT("medium") },
    color_hex: { type: DataTypes.STRING(20) },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    ...commonOptions,
    tableName: "recipe_categories"
});

const Product = sequelize.define("Product", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    category_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    sku: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    short_description: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    sale_price: { type: DataTypes.DECIMAL(12, 2) },
    stock_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
    stock_unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
    stock_per_sale_unit: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 1 },
    sale_unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
    unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
    production_date: { type: DataTypes.DATEONLY },
    expiration_date: { type: DataTypes.DATEONLY },
    thumbnail_url: { type: DataTypes.TEXT },
    is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: {
        type: DataTypes.ENUM("draft", "active", "out_of_stock", "archived"),
        allowNull: false,
        defaultValue: "draft"
    }
}, {
    ...commonOptions,
    tableName: "products"
});

const ProductStoreAllocation = sequelize.define("ProductStoreAllocation", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    store_key: { type: DataTypes.STRING(50), allowNull: false },
    store_name: { type: DataTypes.STRING(120), allowNull: false },
    allocated_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
    publish_mode: {
        type: DataTypes.ENUM("draft", "published"),
        allowNull: false,
        defaultValue: "draft"
    }
}, {
    ...commonOptions,
    tableName: "product_store_allocations",
    indexes: [
        {
            unique: true,
            fields: ["product_id", "store_key"]
        },
        { fields: ["store_key", "publish_mode"] }
    ]
});

const Branch = sequelize.define("Branch", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(120), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    manager: { type: DataTypes.STRING(120) },
    phone: { type: DataTypes.STRING(20) },
    city: { type: DataTypes.STRING(120) },
    address: { type: DataTypes.STRING(255) },
    hours: { type: DataTypes.STRING(50) },
    image_url: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM("active", "paused", "closed"),
        allowNull: false,
        defaultValue: "active"
    }
}, {
    ...commonOptions,
    tableName: "branches",
    indexes: [
        { fields: ["status"] },
        { fields: ["city"] }
    ]
});

const BranchImportRequest = sequelize.define("BranchImportRequest", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    branch_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    branch_key: { type: DataTypes.STRING(50), allowNull: false },
    branch_name: { type: DataTypes.STRING(180), allowNull: false },
    expected_date: { type: DataTypes.DATEONLY },
    note: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM("draft", "pending", "approved", "receiving", "completed", "rejected"),
        allowNull: false,
        defaultValue: "pending"
    },
    status_note: { type: DataTypes.STRING(255) },
    created_by: { type: DataTypes.INTEGER.UNSIGNED },
    approved_at: { type: DataTypes.DATE },
    shipped_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
    rejected_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "branch_import_requests",
    indexes: [
        { fields: ["branch_id"] },
        { fields: ["branch_key"] },
        { fields: ["status"] },
        { fields: ["created_at"] }
    ]
});

const BranchImportRequestItem = sequelize.define("BranchImportRequestItem", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    request_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    sku: { type: DataTypes.STRING(80) },
    thumbnail_url: { type: DataTypes.TEXT },
    unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 1 }
}, {
    ...commonOptions,
    tableName: "branch_import_request_items",
    indexes: [
        { fields: ["request_id"] },
        { fields: ["product_id"] }
    ]
});

const ProductImage = sequelize.define("ProductImage", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    image_url: { type: DataTypes.STRING(255), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
}, {
    ...commonOptions,
    tableName: "product_images",
    updatedAt: false
});

const ProductReview = sequelize.define("ProductReview", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    rating: { type: DataTypes.SMALLINT, allowNull: false },
    comment: { type: DataTypes.TEXT }
}, {
    ...commonOptions,
    tableName: "product_reviews",
    indexes: [
        {
            unique: true,
            fields: ["user_id", "product_id"]
        }
    ]
});

const Supplier = sequelize.define("Supplier", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    logo_url: { type: DataTypes.STRING(255) },
    contact_person: { type: DataTypes.STRING(120) },
    phone: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(150) },
    address: { type: DataTypes.STRING(255) },
    note: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active"
    }
}, {
    ...commonOptions,
    tableName: "suppliers"
});

const InventoryDocument = sequelize.define("InventoryDocument", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    type: {
        type: DataTypes.ENUM("receipt", "adjustment_in", "adjustment_out", "damage", "return_supplier"),
        allowNull: false
    },
    supplier_id: { type: DataTypes.INTEGER.UNSIGNED },
    created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    approved_by: { type: DataTypes.INTEGER.UNSIGNED },
    reference_number: { type: DataTypes.STRING(100) },
    note: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM("draft", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "draft"
    },
    total_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    completed_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "inventory_documents",
    indexes: [
        { fields: ["type"] },
        { fields: ["status"] },
        { fields: ["supplier_id"] },
        { fields: ["created_by"] },
        { fields: ["completed_at"] }
    ]
});

const InventoryDocumentItem = sequelize.define("InventoryDocumentItem", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    document_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(12, 2) },
    line_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    note: { type: DataTypes.STRING(255) }
}, {
    ...commonOptions,
    tableName: "inventory_document_items",
    updatedAt: false
});

const InventoryTransaction = sequelize.define("InventoryTransaction", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    document_id: { type: DataTypes.INTEGER.UNSIGNED },
    reference_type: {
        type: DataTypes.ENUM("inventory_document", "order"),
        allowNull: false,
        defaultValue: "inventory_document"
    },
    reference_id: { type: DataTypes.INTEGER.UNSIGNED },
    movement_type: {
        type: DataTypes.ENUM("receipt", "sale", "adjustment_in", "adjustment_out", "damage", "return_supplier"),
        allowNull: false
    },
    direction: {
        type: DataTypes.ENUM("in", "out"),
        allowNull: false
    },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    stock_before: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    stock_after: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(12, 2) },
    note: { type: DataTypes.STRING(255) },
    created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, {
    ...commonOptions,
    tableName: "inventory_transactions",
    updatedAt: false,
    indexes: [
        { fields: ["product_id", "created_at"] },
        { fields: ["document_id"] },
        { fields: ["reference_type", "reference_id"] },
        { fields: ["movement_type"] }
    ]
});

const Cart = sequelize.define("Cart", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: {
        type: DataTypes.ENUM("active", "converted", "abandoned"),
        allowNull: false,
        defaultValue: "active"
    }
}, {
    ...commonOptions,
    tableName: "carts"
});

const CartItem = sequelize.define("CartItem", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    cart_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, {
    ...commonOptions,
    tableName: "cart_items",
    indexes: [
        {
            unique: true,
            fields: ["cart_id", "product_id"]
        }
    ]
});

const Coupon = sequelize.define("Coupon", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(255) },
    campaign_metadata: { type: DataTypes.TEXT },
    discount_type: { type: DataTypes.ENUM("percent", "fixed"), allowNull: false },
    discount_value: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    min_order_value: { type: DataTypes.DECIMAL(12, 2) },
    max_discount_value: { type: DataTypes.DECIMAL(12, 2) },
    start_date: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE },
    usage_limit: { type: DataTypes.INTEGER.UNSIGNED },
    used_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    ...commonOptions,
    tableName: "coupons"
});

const PromotionCampaign = sequelize.define("PromotionCampaign", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    type: {
        type: DataTypes.ENUM("discount", "buy_x_get_y"),
        allowNull: false,
        defaultValue: "discount"
    },
    status: {
        type: DataTypes.ENUM("draft", "active", "paused", "expired"),
        allowNull: false,
        defaultValue: "active"
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    apply_scope: {
        type: DataTypes.ENUM("products", "categories"),
        allowNull: false,
        defaultValue: "products"
    },
    apply_product_ids: { type: DataTypes.TEXT },
    gift_product_id: { type: DataTypes.INTEGER.UNSIGNED },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    time_range: { type: DataTypes.STRING(120) },
    start_date: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE },
    note: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, {
    ...commonOptions,
    tableName: "promotion_campaigns",
    indexes: [
        { fields: ["type"] },
        { fields: ["status"] },
        { fields: ["is_active"] },
        { fields: ["start_date", "end_date"] }
    ]
});

const Order = sequelize.define("Order", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    order_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED },
    coupon_id: { type: DataTypes.INTEGER.UNSIGNED },
    customer_name: { type: DataTypes.STRING(120), allowNull: false },
    customer_phone: { type: DataTypes.STRING(20), allowNull: false },
    shipping_address: { type: DataTypes.STRING(255), allowNull: false },
    ward: { type: DataTypes.STRING(120) },
    district: { type: DataTypes.STRING(120) },
    city: { type: DataTypes.STRING(120), allowNull: false },
    note: { type: DataTypes.TEXT },
    payment_method: {
        type: DataTypes.ENUM("cod", "bank_transfer", "online"),
        allowNull: false,
        defaultValue: "cod"
    },
    payment_status: {
        type: DataTypes.ENUM("unpaid", "paid", "refunded"),
        allowNull: false,
        defaultValue: "unpaid"
    },
    status: {
        type: DataTypes.ENUM("pending", "confirmed", "preparing", "shipping", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "pending"
    },
    shipped_at: { type: DataTypes.DATE },
    delivered_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
    customer_received_at: { type: DataTypes.DATE },
    shipping_provider: { type: DataTypes.STRING(50) },
    tracking_code: { type: DataTypes.STRING(80) },
    shipping_status: { type: DataTypes.STRING(50) },
    shipping_note: { type: DataTypes.STRING(255) },
    shipping_estimated_minutes: { type: DataTypes.INTEGER.UNSIGNED },
    return_status: { type: DataTypes.STRING(30) },
    return_started_at: { type: DataTypes.DATE },
    return_completed_at: { type: DataTypes.DATE },
    refund_status: { type: DataTypes.STRING(30) },
    refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    refund_reason: { type: DataTypes.TEXT },
    refunded_at: { type: DataTypes.DATE },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    shipping_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, {
    ...commonOptions,
    tableName: "orders"
});

const OrderItem = sequelize.define("OrderItem", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED },
    product_name: { type: DataTypes.STRING(150), allowNull: false },
    unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    line_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, {
    ...commonOptions,
    tableName: "order_items",
    updatedAt: false
});

const Recipe = sequelize.define("Recipe", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    author_id: { type: DataTypes.INTEGER.UNSIGNED },
    recipe_category_id: { type: DataTypes.INTEGER.UNSIGNED },
    title: { type: DataTypes.STRING(180), allowNull: false },
    slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
    image_url: { type: DataTypes.STRING(255) },
    prep_time_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    cook_time_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    servings: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    difficulty: {
        type: DataTypes.ENUM("easy", "medium", "hard"),
        allowNull: false,
        defaultValue: "easy"
    },
    calories: { type: DataTypes.INTEGER.UNSIGNED },
    status: {
        type: DataTypes.ENUM("draft", "published", "archived"),
        allowNull: false,
        defaultValue: "published"
    }
}, {
    ...commonOptions,
    tableName: "recipes"
});

const RecipeIngredient = sequelize.define("RecipeIngredient", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    recipe_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    product_id: { type: DataTypes.INTEGER.UNSIGNED },
    ingredient_name: { type: DataTypes.STRING(150), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
    unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "đơn vị" },
    note: { type: DataTypes.STRING(255) },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
}, {
    ...commonOptions,
    tableName: "recipe_ingredients",
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ["recipe_id", "sort_order"]
        }
    ]
});

const RecipeStep = sequelize.define("RecipeStep", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    recipe_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    step_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    instruction: { type: DataTypes.TEXT, allowNull: false },
    image_url: { type: DataTypes.STRING(255) }
}, {
    ...commonOptions,
    tableName: "recipe_steps",
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ["recipe_id", "step_number"]
        }
    ]
});

const RecipeFavorite = sequelize.define("RecipeFavorite", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    recipe_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
}, {
    ...commonOptions,
    tableName: "recipe_favorites",
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ["user_id", "recipe_id"]
        }
    ]
});

const RecipeReview = sequelize.define("RecipeReview", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    recipe_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    rating: { type: DataTypes.SMALLINT, allowNull: false },
    comment: { type: DataTypes.TEXT }
}, {
    ...commonOptions,
    tableName: "recipe_reviews",
    indexes: [
        {
            unique: true,
            fields: ["user_id", "recipe_id"]
        }
    ]
});

const StaffShiftSlot = sequelize.define("StaffShiftSlot", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.STRING(80), allowNull: false },
    client_id: { type: DataTypes.STRING(80), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    start_time: { type: DataTypes.STRING(10), allowNull: false },
    end_time: { type: DataTypes.STRING(10), allowNull: false },
    tone: {
        type: DataTypes.ENUM("morning", "afternoon", "evening"),
        allowNull: false,
        defaultValue: "morning"
    },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    applies_to_date: { type: DataTypes.DATEONLY },
    created_by: { type: DataTypes.INTEGER.UNSIGNED }
}, {
    ...commonOptions,
    tableName: "staff_shift_slots",
    indexes: [
        {
            unique: true,
            fields: ["branch_id", "client_id"]
        },
        { fields: ["branch_id", "enabled"] },
        { fields: ["applies_to_date"] }
    ]
});

const StaffShiftAssignment = sequelize.define("StaffShiftAssignment", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.STRING(80), allowNull: false },
    shift_slot_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shift_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
        type: DataTypes.ENUM("pending", "confirmed"),
        allowNull: false,
        defaultValue: "pending"
    },
    source: {
        type: DataTypes.ENUM("self", "manager"),
        allowNull: false,
        defaultValue: "self"
    },
    registered_by: { type: DataTypes.INTEGER.UNSIGNED },
    registered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    confirmed_by: { type: DataTypes.INTEGER.UNSIGNED },
    confirmed_at: { type: DataTypes.DATE },
    confirmation_source: { type: DataTypes.STRING(40) }
}, {
    ...commonOptions,
    tableName: "staff_shift_assignments",
    indexes: [
        {
            unique: true,
            fields: ["branch_id", "shift_slot_id", "shift_date", "employee_id"]
        },
        { fields: ["branch_id", "shift_date"] },
        { fields: ["employee_id", "shift_date"] },
        { fields: ["status"] }
    ]
});

const StaffShiftHoliday = sequelize.define("StaffShiftHoliday", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.STRING(80), allowNull: false },
    holiday_date: { type: DataTypes.DATEONLY, allowNull: false },
    note: { type: DataTypes.STRING(255) }
}, {
    ...commonOptions,
    tableName: "staff_shift_holidays",
    indexes: [
        {
            unique: true,
            fields: ["branch_id", "holiday_date"]
        }
    ]
});

const PaymentTransaction = sequelize.define("PaymentTransaction", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    payment_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    gateway: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "mock_gateway" },
    status: {
        type: DataTypes.ENUM("pending", "paid", "failed", "cancelled", "expired"),
        allowNull: false,
        defaultValue: "pending"
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    checkout_token: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    gateway_reference: { type: DataTypes.STRING(120) },
    gateway_checkout_url: { type: DataTypes.TEXT },
    paid_at: { type: DataTypes.DATE },
    expired_at: { type: DataTypes.DATE },
    failure_reason: { type: DataTypes.STRING(255) }
}, {
    ...commonOptions,
    tableName: "payment_transactions",
    indexes: [
        { fields: ["order_id"] },
        { fields: ["status"] },
        { fields: ["checkout_token"] }
    ]
});

const ChatConversation = sequelize.define("ChatConversation", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_staff_id: { type: DataTypes.INTEGER.UNSIGNED },
    subject: { type: DataTypes.STRING(150) },
    status: {
        type: DataTypes.ENUM("open", "closed"),
        allowNull: false,
        defaultValue: "open"
    },
    last_message_preview: { type: DataTypes.STRING(255) },
    last_message_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "chat_conversations",
    indexes: [
        { fields: ["customer_id"] },
        { fields: ["assigned_staff_id"] },
        { fields: ["status"] },
        { fields: ["last_message_at"] }
    ]
});

const ChatMessage = sequelize.define("ChatMessage", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    conversation_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sender_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sender_role: {
        type: DataTypes.ENUM("admin", "staff", "customer"),
        allowNull: false
    },
    message_type: {
        type: DataTypes.ENUM("text", "image", "system"),
        allowNull: false,
        defaultValue: "text"
    },
    content: { type: DataTypes.TEXT, allowNull: false },
    attachment_url: { type: DataTypes.STRING(255) },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_at: { type: DataTypes.DATE }
}, {
    ...commonOptions,
    tableName: "chat_messages",
    indexes: [
        { fields: ["conversation_id", "created_at"] },
        { fields: ["sender_id"] },
        { fields: ["is_read"] }
    ]
});

User.hasMany(UserAddress, { foreignKey: "user_id", as: "addresses", onDelete: "CASCADE" });
UserAddress.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });
User.hasMany(RefreshToken, { foreignKey: "user_id", as: "refresh_tokens", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });
User.hasMany(Notification, { foreignKey: "user_id", as: "notifications", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });

Category.belongsTo(Category, { foreignKey: "parent_id", as: "parent", onDelete: "SET NULL" });
Category.hasMany(Category, { foreignKey: "parent_id", as: "children", onDelete: "SET NULL" });

Category.hasMany(Product, { foreignKey: "category_id", as: "products", onDelete: "RESTRICT" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category", onDelete: "RESTRICT" });

RecipeCategory.hasMany(Recipe, { foreignKey: "recipe_category_id", as: "recipes", onDelete: "SET NULL" });
Recipe.belongsTo(RecipeCategory, { foreignKey: "recipe_category_id", as: "recipe_category", onDelete: "SET NULL" });

Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images", onDelete: "CASCADE" });
ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "CASCADE" });
Product.hasMany(ProductStoreAllocation, { foreignKey: "product_id", as: "store_allocations", onDelete: "CASCADE" });
ProductStoreAllocation.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "CASCADE" });
Branch.hasMany(BranchImportRequest, { foreignKey: "branch_id", as: "import_requests", onDelete: "CASCADE" });
BranchImportRequest.belongsTo(Branch, { foreignKey: "branch_id", as: "branch", onDelete: "CASCADE" });
User.hasMany(BranchImportRequest, { foreignKey: "created_by", as: "created_branch_import_requests", onDelete: "SET NULL" });
BranchImportRequest.belongsTo(User, { foreignKey: "created_by", as: "creator", onDelete: "SET NULL" });
BranchImportRequest.hasMany(BranchImportRequestItem, { foreignKey: "request_id", as: "items", onDelete: "CASCADE" });
BranchImportRequestItem.belongsTo(BranchImportRequest, { foreignKey: "request_id", as: "request", onDelete: "CASCADE" });
Product.hasMany(BranchImportRequestItem, { foreignKey: "product_id", as: "branch_import_request_items", onDelete: "RESTRICT" });
BranchImportRequestItem.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "RESTRICT" });
Product.hasMany(ProductReview, { foreignKey: "product_id", as: "reviews", onDelete: "CASCADE" });
ProductReview.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "CASCADE" });
User.hasMany(ProductReview, { foreignKey: "user_id", as: "product_reviews", onDelete: "CASCADE" });
ProductReview.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });

Supplier.hasMany(InventoryDocument, { foreignKey: "supplier_id", as: "inventory_documents", onDelete: "SET NULL" });
InventoryDocument.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier", onDelete: "SET NULL" });
User.hasMany(InventoryDocument, { foreignKey: "created_by", as: "created_inventory_documents", onDelete: "RESTRICT" });
InventoryDocument.belongsTo(User, { foreignKey: "created_by", as: "creator", onDelete: "RESTRICT" });
User.hasMany(InventoryDocument, { foreignKey: "approved_by", as: "approved_inventory_documents", onDelete: "SET NULL" });
InventoryDocument.belongsTo(User, { foreignKey: "approved_by", as: "approver", onDelete: "SET NULL" });

InventoryDocument.hasMany(InventoryDocumentItem, { foreignKey: "document_id", as: "items", onDelete: "CASCADE" });
InventoryDocumentItem.belongsTo(InventoryDocument, { foreignKey: "document_id", as: "document", onDelete: "CASCADE" });
Product.hasMany(InventoryDocumentItem, { foreignKey: "product_id", as: "inventory_document_items", onDelete: "RESTRICT" });
InventoryDocumentItem.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "RESTRICT" });

Product.hasMany(InventoryTransaction, { foreignKey: "product_id", as: "inventory_transactions", onDelete: "CASCADE" });
InventoryTransaction.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "CASCADE" });
InventoryDocument.hasMany(InventoryTransaction, { foreignKey: "document_id", as: "transactions", onDelete: "SET NULL" });
InventoryTransaction.belongsTo(InventoryDocument, { foreignKey: "document_id", as: "document", onDelete: "SET NULL" });
User.hasMany(InventoryTransaction, { foreignKey: "created_by", as: "inventory_transactions", onDelete: "SET NULL" });
InventoryTransaction.belongsTo(User, { foreignKey: "created_by", as: "creator", onDelete: "SET NULL" });

User.hasMany(Cart, { foreignKey: "user_id", as: "carts", onDelete: "CASCADE" });
Cart.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });

Cart.hasMany(CartItem, { foreignKey: "cart_id", as: "items", onDelete: "CASCADE" });
CartItem.belongsTo(Cart, { foreignKey: "cart_id", as: "cart", onDelete: "CASCADE" });
Product.hasMany(CartItem, { foreignKey: "product_id", as: "cart_items", onDelete: "RESTRICT" });
CartItem.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "RESTRICT" });

User.hasMany(Order, { foreignKey: "user_id", as: "orders", onDelete: "SET NULL" });
Order.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "SET NULL" });
Coupon.hasMany(Order, { foreignKey: "coupon_id", as: "orders", onDelete: "SET NULL" });
Order.belongsTo(Coupon, { foreignKey: "coupon_id", as: "coupon", onDelete: "SET NULL" });
User.hasMany(PromotionCampaign, { foreignKey: "created_by", as: "promotion_campaigns", onDelete: "SET NULL" });
PromotionCampaign.belongsTo(User, { foreignKey: "created_by", as: "creator", onDelete: "SET NULL" });
Product.hasMany(PromotionCampaign, { foreignKey: "gift_product_id", as: "gift_promotion_campaigns", onDelete: "SET NULL" });
PromotionCampaign.belongsTo(Product, { foreignKey: "gift_product_id", as: "gift_product", onDelete: "SET NULL" });

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order", onDelete: "CASCADE" });
Product.hasMany(OrderItem, { foreignKey: "product_id", as: "order_items", onDelete: "SET NULL" });
OrderItem.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "SET NULL" });

Order.hasMany(PaymentTransaction, { foreignKey: "order_id", as: "payments", onDelete: "CASCADE" });
PaymentTransaction.belongsTo(Order, { foreignKey: "order_id", as: "order", onDelete: "CASCADE" });

User.hasMany(Recipe, { foreignKey: "author_id", as: "recipes", onDelete: "SET NULL" });
Recipe.belongsTo(User, { foreignKey: "author_id", as: "author", onDelete: "SET NULL" });

Recipe.hasMany(RecipeIngredient, { foreignKey: "recipe_id", as: "ingredients", onDelete: "CASCADE" });
RecipeIngredient.belongsTo(Recipe, { foreignKey: "recipe_id", as: "recipe", onDelete: "CASCADE" });
Product.hasMany(RecipeIngredient, { foreignKey: "product_id", as: "recipe_ingredients", onDelete: "SET NULL" });
RecipeIngredient.belongsTo(Product, { foreignKey: "product_id", as: "product", onDelete: "SET NULL" });

Recipe.hasMany(RecipeStep, { foreignKey: "recipe_id", as: "steps", onDelete: "CASCADE" });
RecipeStep.belongsTo(Recipe, { foreignKey: "recipe_id", as: "recipe", onDelete: "CASCADE" });

User.hasMany(RecipeFavorite, { foreignKey: "user_id", as: "recipe_favorites", onDelete: "CASCADE" });
RecipeFavorite.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });
Recipe.hasMany(RecipeFavorite, { foreignKey: "recipe_id", as: "favorites", onDelete: "CASCADE" });
RecipeFavorite.belongsTo(Recipe, { foreignKey: "recipe_id", as: "recipe", onDelete: "CASCADE" });

User.hasMany(RecipeReview, { foreignKey: "user_id", as: "recipe_reviews", onDelete: "CASCADE" });
RecipeReview.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });
Recipe.hasMany(RecipeReview, { foreignKey: "recipe_id", as: "reviews", onDelete: "CASCADE" });
RecipeReview.belongsTo(Recipe, { foreignKey: "recipe_id", as: "recipe", onDelete: "CASCADE" });

User.hasMany(StaffShiftSlot, { foreignKey: "created_by", as: "created_shift_slots", onDelete: "SET NULL" });
StaffShiftSlot.belongsTo(User, { foreignKey: "created_by", as: "creator", onDelete: "SET NULL" });
StaffShiftSlot.hasMany(StaffShiftAssignment, { foreignKey: "shift_slot_id", as: "assignments", onDelete: "CASCADE" });
StaffShiftAssignment.belongsTo(StaffShiftSlot, { foreignKey: "shift_slot_id", as: "slot", onDelete: "CASCADE" });
User.hasMany(StaffShiftAssignment, { foreignKey: "employee_id", as: "shift_assignments", onDelete: "CASCADE" });
StaffShiftAssignment.belongsTo(User, { foreignKey: "employee_id", as: "employee", onDelete: "CASCADE" });
User.hasMany(StaffShiftAssignment, { foreignKey: "registered_by", as: "registered_shift_assignments", onDelete: "SET NULL" });
StaffShiftAssignment.belongsTo(User, { foreignKey: "registered_by", as: "registrar", onDelete: "SET NULL" });
User.hasMany(StaffShiftAssignment, { foreignKey: "confirmed_by", as: "confirmed_shift_assignments", onDelete: "SET NULL" });
StaffShiftAssignment.belongsTo(User, { foreignKey: "confirmed_by", as: "confirmer", onDelete: "SET NULL" });

User.hasMany(ChatConversation, { foreignKey: "customer_id", as: "customer_conversations", onDelete: "CASCADE" });
ChatConversation.belongsTo(User, { foreignKey: "customer_id", as: "customer", onDelete: "CASCADE" });
User.hasMany(ChatConversation, { foreignKey: "assigned_staff_id", as: "assigned_conversations", onDelete: "SET NULL" });
ChatConversation.belongsTo(User, { foreignKey: "assigned_staff_id", as: "assigned_staff", onDelete: "SET NULL" });

ChatConversation.hasMany(ChatMessage, { foreignKey: "conversation_id", as: "messages", onDelete: "CASCADE" });
ChatMessage.belongsTo(ChatConversation, { foreignKey: "conversation_id", as: "conversation", onDelete: "CASCADE" });
User.hasMany(ChatMessage, { foreignKey: "sender_id", as: "sent_messages", onDelete: "CASCADE" });
ChatMessage.belongsTo(User, { foreignKey: "sender_id", as: "sender", onDelete: "CASCADE" });

const WalletTransfer = sequelize.define("WalletTransfer", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    bank_name: { type: DataTypes.STRING(100), allowNull: false },
    account_number: { type: DataTypes.STRING(30), allowNull: false },
    account_holder: { type: DataTypes.STRING(120), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    status: {
        type: DataTypes.ENUM("pending", "processing", "completed", "rejected"),
        allowNull: false,
        defaultValue: "pending"
    },
    note: { type: DataTypes.STRING(255) }
}, {
    ...commonOptions,
    tableName: "wallet_transfers",
    indexes: [
        { fields: ["user_id"] },
        { fields: ["status"] },
        { fields: ["created_at"] }
    ]
});

User.hasMany(WalletTransfer, { foreignKey: "user_id", as: "wallet_transfers", onDelete: "CASCADE" });
WalletTransfer.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });

module.exports = {
    sequelize,
    User,
    UserAddress,
    RefreshToken,
    Notification,
    MediaAsset,
    Category,
    RecipeCategory,
    Product,
    ProductStoreAllocation,
    Branch,
    BranchImportRequest,
    BranchImportRequestItem,
    ProductImage,
    ProductReview,
    Supplier,
    InventoryDocument,
    InventoryDocumentItem,
    InventoryTransaction,
    Cart,
    CartItem,
    Coupon,
    PromotionCampaign,
    Order,
    OrderItem,
    PaymentTransaction,
    Recipe,
    RecipeIngredient,
    RecipeStep,
    RecipeFavorite,
    RecipeReview,
    StaffShiftSlot,
    StaffShiftAssignment,
    StaffShiftHoliday,
    ChatConversation,
    ChatMessage,
    WalletTransfer
};
