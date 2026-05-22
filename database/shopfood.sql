CREATE DATABASE IF NOT EXISTS `shopfood`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `shopfood`;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    avatar_url VARCHAR(255) NULL,
    role ENUM('admin', 'staff', 'customer') NOT NULL DEFAULT 'customer',
    status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_email (email)
);

CREATE TABLE IF NOT EXISTS user_addresses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    ward VARCHAR(120) NULL,
    district VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_addresses_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id INT UNSIGNED NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT NULL,
    image_url MEDIUMTEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_categories_slug (slug),
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    short_description VARCHAR(255) NULL,
    description TEXT NULL,
    price DECIMAL(12, 2) NOT NULL,
    sale_price DECIMAL(12, 2) NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL DEFAULT 'item',
    production_date DATE NULL,
    expiration_date DATE NULL,
    thumbnail_url VARCHAR(255) NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('draft', 'active', 'out_of_stock', 'archived') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_products_slug (slug),
    UNIQUE KEY uk_products_sku (sku),
    KEY idx_products_category (category_id),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS product_images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_product_images_product (product_id),
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    status ENUM('active', 'converted', 'abandoned') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_carts_user (user_id),
    CONSTRAINT fk_carts_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cart_items_cart_product (cart_id, product_id),
    CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id) REFERENCES carts(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS coupons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    campaign_metadata TEXT NULL,
    discount_type ENUM('percent', 'fixed') NOT NULL,
    discount_value DECIMAL(12, 2) NOT NULL,
    min_order_value DECIMAL(12, 2) NULL,
    max_discount_value DECIMAL(12, 2) NULL,
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    usage_limit INT UNSIGNED NULL,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_coupons_code (code)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(50) NOT NULL,
    user_id INT UNSIGNED NULL,
    coupon_id INT UNSIGNED NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    shipping_address VARCHAR(255) NOT NULL,
    ward VARCHAR(120) NULL,
    district VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL,
    note TEXT NULL,
    payment_method ENUM('cod', 'bank_transfer', 'online') NOT NULL DEFAULT 'cod',
    payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
    status ENUM('pending', 'confirmed', 'preparing', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_orders_order_code (order_code),
    KEY idx_orders_user (user_id),
    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_orders_coupon
        FOREIGN KEY (coupon_id) REFERENCES coupons(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    product_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_items_order (order_id),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recipes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    author_id INT UNSIGNED NULL,
    title VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT NULL,
    image_url MEDIUMTEXT NULL,
    prep_time_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    cook_time_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    servings INT UNSIGNED NOT NULL DEFAULT 1,
    difficulty ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'easy',
    calories INT UNSIGNED NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipes_slug (slug),
    CONSTRAINT fk_recipes_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    ingredient_name VARCHAR(150) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL DEFAULT 'item',
    note VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipe_ingredients_recipe_sort (recipe_id, sort_order),
    CONSTRAINT fk_recipe_ingredients_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_recipe_ingredients_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recipe_steps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT UNSIGNED NOT NULL,
    step_number INT UNSIGNED NOT NULL,
    instruction TEXT NOT NULL,
    image_url VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipe_steps_recipe_step (recipe_id, step_number),
    CONSTRAINT fk_recipe_steps_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_favorites (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    recipe_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipe_favorites_user_recipe (user_id, recipe_id),
    CONSTRAINT fk_recipe_favorites_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_recipe_favorites_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_reviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    recipe_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_recipe_reviews_user_recipe (user_id, recipe_id),
    CONSTRAINT fk_recipe_reviews_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_recipe_reviews_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE
);



-- ============================================
-- DU LIEU MAU SHOPFOOD
-- ============================================
USE `shopfood`;

INSERT INTO categories (name, slug, description, image_url, is_active)
VALUES
    ('Thit heo', 'thit-heo', 'Cac loai thit heo tuoi cho bua an hang ngay.', '/uploads/categories/danhmuc_thitheo.png', TRUE),
    ('Thit bo', 'thit-bo', 'Thit bo tuoi, thit bo cat san va cac phan bo pho bien.', '/uploads/categories/danhmuc_thibo.png', TRUE),
    ('Thit ga', 'thit-ga', 'Ga tuoi, ga lam san va cac phan thit ga tien che bien.', '/uploads/categories/danhmuc_thitga.png', TRUE),
    ('Hai san', 'hai-san', 'Hai san tuoi song va dong lanh cho bua an gia dinh.', '/uploads/categories/danhmuc_haisan.png', TRUE),
    ('Rau la', 'rau-la', 'Rau la xanh tuoi dung cho mon luoc, xao va salad.', '/uploads/categories/danhmuc_raula.png', TRUE),
    ('Rau cu', 'rau-cu', 'Rau cu tuoi, de bao quan va phu hop nhieu mon an.', '/uploads/categories/danhmuc_raucu.png', TRUE),
    ('Trai cay', 'trai-cay', 'Trai cay tuoi theo mua cho nhu cau an uong hang ngay.', '/uploads/categories/danhmuc_traicay.png', TRUE),
    ('Mi tom', 'mi-tom', 'Mi goi, thuc pham tien loi va do kho an lien.', '/uploads/categories/danhmuc_mitom.png', TRUE),
    ('Sua', 'sua', 'Sua tuoi, sua hop va cac san pham dinh duong tu sua.', '/uploads/categories/danhmuc_sua.png', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    image_url = VALUES(image_url),
    is_active = VALUES(is_active);

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'hai-san' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE slug = 'thit-ca' LIMIT 1);

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'mi-tom' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE slug = 'gia-vi' LIMIT 1);

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'mi-tom' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE slug = 'do-kho' LIMIT 1);

DELETE FROM categories WHERE slug IN ('thit-ca', 'gia-vi', 'do-kho');

INSERT INTO products (


    category_id,
    name,
    slug,
    sku,
    short_description,
    price,
    sale_price,
    stock_quantity,
    unit,
    status
)
VALUES
    ((SELECT id FROM categories WHERE slug = 'mi-tom'), 'Gao trang', 'gao-trang', 'SKU-GAO-001', 'Gao trang thom deo', 22000, 20000, 150, 'kg', 'active'),
    ((SELECT id FROM categories WHERE slug = 'thit-ga'), 'Trung ga', 'trung-ga', 'SKU-TRUNG-001', 'Trung ga tuoi', 35000, NULL, 200, 'hop', 'active'),
    ((SELECT id FROM categories WHERE slug = 'rau-la'), 'Hanh la', 'hanh-la', 'SKU-HANH-001', 'Hanh la tuoi', 7000, NULL, 80, 'bo', 'active'),
    ((SELECT id FROM categories WHERE slug = 'mi-tom'), 'Nuoc mam', 'nuoc-mam', 'SKU-NM-001', 'Nuoc mam truyen thong', 18000, NULL, 60, 'chai', 'active'),
    ((SELECT id FROM categories WHERE slug = 'mi-tom'), 'Dau an', 'dau-an', 'SKU-DAU-001', 'Dau an tinh luyen', 42000, NULL, 50, 'chai', 'active'),
    ((SELECT id FROM categories WHERE slug = 'thit-bo'), 'Thit bo', 'thit-bo', 'SKU-BO-001', 'Thit bo tuoi', 180000, 165000, 40, 'kg', 'active'),
    ((SELECT id FROM categories WHERE slug = 'rau-la'), 'Rau cai', 'rau-cai', 'SKU-RAU-001', 'Rau cai xanh', 12000, NULL, 90, 'bo', 'active'),
    ((SELECT id FROM categories WHERE slug = 'rau-cu'), 'Toi', 'toi', 'SKU-TOI-001', 'Toi thom', 10000, NULL, 70, 'cu', 'active')
ON DUPLICATE KEY UPDATE
    category_id = VALUES(category_id),
    name = VALUES(name),
    short_description = VALUES(short_description),
    price = VALUES(price),
    sale_price = VALUES(sale_price),
    stock_quantity = VALUES(stock_quantity),
    unit = VALUES(unit),
    status = VALUES(status);

INSERT INTO recipes (
    title,
    slug,
    description,
    prep_time_minutes,
    cook_time_minutes,
    servings,
    difficulty,
    calories,
    status
)
VALUES
    ('Cơm chiên trứng', 'com-chien-trung', 'Món cơm chiên nhanh gọn, dùng trực tiếp nguyên liệu trong cửa hàng.', 10, 15, 2, 'easy', 450, 'published'),
    ('Bò xào rau cải', 'bo-xao-rau-cai', 'Món bò xào rau cải đơn giản, dễ nấu cho bữa cơm gia đình.', 15, 12, 3, 'medium', 380, 'published')
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    description = VALUES(description),
    prep_time_minutes = VALUES(prep_time_minutes),
    cook_time_minutes = VALUES(cook_time_minutes),
    servings = VALUES(servings),
    difficulty = VALUES(difficulty),
    calories = VALUES(calories),
    status = VALUES(status);

INSERT INTO recipe_ingredients (
    recipe_id,
    product_id,
    ingredient_name,
    quantity,
    unit,
    note,
    sort_order
)
VALUES
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), (SELECT id FROM products WHERE slug = 'gao-trang'), 'Gạo trắng', 0.50, 'kg', 'Nấu cơm trước khi chiên', 1),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), (SELECT id FROM products WHERE slug = 'trung-ga'), 'Trứng gà', 4.00, 'quả', NULL, 2),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), (SELECT id FROM products WHERE slug = 'hanh-la'), 'Hành lá', 1.00, 'bó', 'Cắt nhỏ', 3),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), (SELECT id FROM products WHERE slug = 'nuoc-mam'), 'Nước mắm', 2.00, 'muỗng', NULL, 4),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), (SELECT id FROM products WHERE slug = 'dau-an'), 'Dầu ăn', 2.00, 'muỗng', NULL, 5),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), (SELECT id FROM products WHERE slug = 'thit-bo'), 'Thịt bò', 0.40, 'kg', 'Thái lát mỏng', 1),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), (SELECT id FROM products WHERE slug = 'rau-cai'), 'Rau cải', 2.00, 'bó', 'Rửa sạch và cắt khúc', 2),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), (SELECT id FROM products WHERE slug = 'toi'), 'Tỏi', 2.00, 'tép', 'Đập dập nhẹ', 3),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), (SELECT id FROM products WHERE slug = 'dau-an'), 'Dầu ăn', 1.00, 'muỗng', NULL, 4),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), (SELECT id FROM products WHERE slug = 'nuoc-mam'), 'Nước mắm', 1.00, 'muỗng', NULL, 5)
ON DUPLICATE KEY UPDATE
    product_id = VALUES(product_id),
    ingredient_name = VALUES(ingredient_name),
    quantity = VALUES(quantity),
    unit = VALUES(unit),
    note = VALUES(note);

INSERT INTO recipe_steps (
    recipe_id,
    step_number,
    instruction
)
VALUES
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), 1, 'Nấu cơm chín rồi để nguội trước khi chiên.'),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), 2, 'Đánh tan trứng, sau đó chiên sơ với một ít dầu ăn.'),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), 3, 'Cho cơm, nước mắm và hành lá vào chảo, đảo đều từ 5 đến 7 phút.'),
    ((SELECT id FROM recipes WHERE slug = 'com-chien-trung'), 4, 'Dùng khi còn nóng.'),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), 1, 'Ướp thịt bò với một ít nước mắm trong 10 phút.'),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), 2, 'Làm nóng dầu, phi tỏi thơm rồi xào nhanh thịt bò trên lửa lớn.'),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), 3, 'Cho rau cải vào và tiếp tục đảo đến khi vừa chín tới.'),
    ((SELECT id FROM recipes WHERE slug = 'bo-xao-rau-cai'), 4, 'Nêm nếm lại rồi dùng khi còn nóng.')
ON DUPLICATE KEY UPDATE
    instruction = VALUES(instruction);
