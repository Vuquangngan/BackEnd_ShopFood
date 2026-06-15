const fs = require("fs");
const path = require("path");
const {
    sequelize,
    Category,
    Product,
    ProductImage,
    ProductStoreAllocation
} = require("../models");

require("dotenv").config({ quiet: true });

const projectRoot = path.resolve(__dirname, "../../..");
const sourceRoot = path.join(projectRoot, "Images", "sanpham");
const uploadRoot = path.resolve(__dirname, "..", "uploads", "products");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const categoryLabels = {
    sp_haisan: { name: "Hải sản", slug: "hai-san", image_url: "/uploads/categories/danhmuc_haisan.png" },
    sp_raucu: { name: "Rau củ", slug: "rau-cu", image_url: "/uploads/categories/danhmuc_raucu.png" },
    sp_raula: { name: "Rau lá", slug: "rau-la", image_url: "/uploads/categories/danhmuc_raula.png" },
    sp_sua: { name: "Sữa", slug: "sua", image_url: "/uploads/categories/danhmuc_sua.png" },
    sp_thiga: { name: "Thịt gà", slug: "thit-ga", image_url: "/uploads/categories/danhmuc_thitga.png" },
    sp_thitbo: { name: "Thịt bò", slug: "thit-bo", image_url: "/uploads/categories/danhmuc_thibo.png" },
    sp_thitheo: { name: "Thịt heo", slug: "thit-heo", image_url: "/uploads/categories/danhmuc_thiheo.png" },
    sp_traicay: { name: "Trái cây", slug: "trai-cay", image_url: "/uploads/categories/danhmuc_traicay.png" }
};

const productLabels = {
    sp_bachtuoc: "Bạch tuộc",
    sp_mucnangPhanThiet: "Mực nang Phan Thiết",
    sp_mucong: "Mực ống",
    sp_tombocvo: "Tôm bóc vỏ",
    sp_tomsu: "Tôm sú",
    sp_bidao: "Bí đao",
    sp_bido: "Bí đỏ",
    sp_cachua: "Cà chua",
    sp_khoaitay: "Khoai tây",
    sp_muopdang: "Mướp đắng",
    sp_muophuong: "Mướp hương",
    sp_raucaibap: "Rau cải bắp",
    sp_raucaicay: "Rau cải cay",
    sp_raucaichip: "Rau cải chíp",
    sp_raumuong: "Rau muống",
    sp_raungot: "Rau ngót",
    sp_suahat: "Sữa hạt",
    sp_suaTH: "Sữa TH",
    sp_suaTHthanhtrung1L: "Sữa TH thanh trùng 1L",
    sp_tuisuaVinamil: "Túi sữa Vinamilk",
    sp_canhga: "Cánh gà",
    sp_canhgiuaga: "Cánh giữa gà",
    sp_duiga: "Đùi gà",
    sp_ganguyencon: "Gà nguyên con",
    sp_maduiga: "Má đùi gà",
    sp_ucga: "Ức gà",
    sp_bachibo: "Ba chỉ bò",
    sp_thimongbo: "Thịt mông bò",
    sp_thitvaibo: "Thịt vai bò",
    sp_bachiheo: "Ba chỉ heo",
    sp_changioheo: "Chân giò heo",
    sp_thittaiheo: "Thịt tai heo",
    sp_thitthanheo: "Thịt thăn heo",
    sp_buoi: "Bưởi",
    sp_le: "Lê",
    sp_leduongTrungQuoc: "Lê đường Trung Quốc",
    sp_roi: "Quả roi",
    sp_tao: "Táo"
};

const priceByCategory = {
    "hai-san": 220000,
    "thit-bo": 185000,
    "thit-heo": 115000,
    "thit-ga": 85000,
    "trai-cay": 65000,
    "sua": 36000,
    "rau-cu": 24000,
    "rau-la": 15000
};

function stripPrefix(value) {
    return String(value || "").replace(/^sp[_-]?/i, "");
}

function slugify(value, fallback = "san-pham") {
    const normalized = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-");

    return normalized || fallback;
}

function fallbackName(fileBaseName) {
    return stripPrefix(fileBaseName)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^./, (letter) => letter.toUpperCase()) || "Sản phẩm";
}

function getImageFiles() {
    if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Không tìm thấy thư mục ảnh: ${sourceRoot}`);
    }

    return fs.readdirSync(sourceRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((categoryDir) => {
            const categoryPath = path.join(sourceRoot, categoryDir.name);
            return fs.readdirSync(categoryPath, { withFileTypes: true })
                .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
                .map((entry) => ({
                    categoryKey: categoryDir.name,
                    fileName: entry.name,
                    sourcePath: path.join(categoryPath, entry.name)
                }));
        });
}

async function upsertCategory(categoryKey, transaction) {
    const label = categoryLabels[categoryKey] || {
        name: fallbackName(categoryKey),
        slug: slugify(stripPrefix(categoryKey), "danh-muc"),
        image_url: null
    };

    const existing = await Category.findOne({ where: { slug: label.slug }, transaction });
    const payload = {
        name: label.name,
        slug: label.slug,
        description: `Danh mục ${label.name.toLowerCase()} được nhập từ thư mục ảnh sản phẩm.`,
        image_url: label.image_url,
        is_active: true
    };

    if (existing) {
        await existing.update(payload, { transaction });
        return existing;
    }

    return Category.create(payload, { transaction });
}

async function upsertProduct({ category, categorySlug, categoryKey, fileName, imageUrl }, transaction) {
    const ext = path.extname(fileName);
    const fileBaseName = path.basename(fileName, ext);
    const name = productLabels[fileBaseName] || fallbackName(fileBaseName);
    const slug = slugify(name);
    const sku = `SKU-${slug.toUpperCase().replace(/-/g, "-")}`;
    const price = priceByCategory[categorySlug] || 50000;

    const payload = {
        category_id: category.id,
        name,
        slug,
        sku,
        short_description: `${name} tươi ngon, được nhập từ nguồn ảnh sản phẩm.`,
        description: `${name} được chọn lọc kỹ, bảo quản đúng quy trình và phù hợp cho bữa ăn hằng ngày.`,
        price,
        sale_price: null,
        stock_quantity: 50,
        stock_unit: "kg",
        stock_per_sale_unit: 1,
        sale_unit: "kg",
        unit: "kg",
        thumbnail_url: imageUrl,
        is_featured: false,
        is_published: true,
        status: "active"
    };

    const existing = await Product.findOne({ where: { slug }, transaction });
    const product = existing
        ? await existing.update(payload, { transaction })
        : await Product.create(payload, { transaction });

    await ProductImage.destroy({ where: { product_id: product.id }, transaction });
    await ProductImage.create({
        product_id: product.id,
        image_url: imageUrl,
        sort_order: 1
    }, { transaction });

    await ProductStoreAllocation.findOrCreate({
        where: {
            product_id: product.id,
            store_key: "store_1"
        },
        defaults: {
            product_id: product.id,
            store_key: "store_1",
            store_name: "Chi nhánh trung tâm",
            allocated_quantity: 20,
            publish_mode: "published"
        },
        transaction
    });

    return {
        category: categoryKey,
        name,
        slug,
        imageUrl
    };
}

async function main() {
    const imageFiles = getImageFiles();
    fs.mkdirSync(uploadRoot, { recursive: true });

    const imported = [];
    await sequelize.authenticate();

    await sequelize.transaction(async (transaction) => {
        const categoriesByKey = {};

        for (const image of imageFiles) {
            if (!categoriesByKey[image.categoryKey]) {
                categoriesByKey[image.categoryKey] = await upsertCategory(image.categoryKey, transaction);
            }

            const destinationName = `${image.categoryKey}_${image.fileName}`;
            const destinationPath = path.join(uploadRoot, destinationName);
            if (!fs.existsSync(destinationPath)) {
                fs.copyFileSync(image.sourcePath, destinationPath);
            }

            const categorySlug = categoriesByKey[image.categoryKey].slug;
            imported.push(await upsertProduct({
                category: categoriesByKey[image.categoryKey],
                categorySlug,
                categoryKey: image.categoryKey,
                fileName: image.fileName,
                imageUrl: `/uploads/products/${destinationName}`
            }, transaction));
        }
    });

    console.log(`Đã nhập ${imported.length} sản phẩm từ ${sourceRoot}`);
    imported.forEach((item) => {
        console.log(`- ${item.name} (${item.slug}) -> ${item.imageUrl}`);
    });
}

main()
    .catch((error) => {
        console.error("Không thể nhập sản phẩm từ ảnh.");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await sequelize.close();
    });
