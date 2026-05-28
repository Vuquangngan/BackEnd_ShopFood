require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
    sequelize,
    MediaAsset,
    Category,
    RecipeCategory,
    Product,
    ProductImage,
    Recipe,
    RecipeStep
} = require("../models");

const uploadRoot = path.join(__dirname, "..", "uploads");
const productUploadRoot = path.join(uploadRoot, "products");

function normalizeUploadPath(value) {
    const text = String(value || "").trim();
    if (!text.startsWith("/uploads/")) return "";
    return text.replace(/^\/uploads\//, "").replaceAll("\\", "/");
}

async function getAssetUrl(oldUrl) {
    const relativePath = normalizeUploadPath(oldUrl);
    if (!relativePath) return oldUrl;

    const absolutePath = path.join(uploadRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        console.warn(`Missing local file: ${oldUrl}`);
        return oldUrl;
    }

    const buffer = fs.readFileSync(absolutePath);
    const folder = path.dirname(relativePath).replaceAll("\\", "/") || "general";
    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
                ? "image/gif"
                : "image/png";

    let asset = await MediaAsset.findOne({
        where: {
            folder,
            file_name: fileName,
            size: buffer.length
        }
    });

    if (!asset) {
        asset = await MediaAsset.create({
            folder,
            original_name: fileName,
            file_name: fileName,
            mime_type: mimeType,
            size: buffer.length,
            data: buffer
        });
    }

    return `/api/uploads/assets/${asset.id}`;
}

async function migrateModel(model, field, label) {
    const rows = await model.findAll({
        where: {
            [field]: {
                [Op.like]: "/uploads/%"
            }
        }
    });

    let updated = 0;
    for (const row of rows) {
        const oldUrl = row[field];
        const nextUrl = await getAssetUrl(oldUrl);
        if (nextUrl && nextUrl !== oldUrl) {
            row[field] = nextUrl;
            await row.save();
            updated += 1;
        }
    }

    console.log(`${label}: ${updated}/${rows.length} updated`);
}

function normalizeKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function guessProductImagePath(product) {
    if (!fs.existsSync(productUploadRoot)) return "";

    const productKey = normalizeKey(product.name);
    if (!productKey) return "";

    const files = fs.readdirSync(productUploadRoot).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));
    const exact = files.find((file) => normalizeKey(file).includes(productKey));
    if (exact) return `/uploads/products/${exact}`;

    const tokens = normalizeKey(product.name)
        .match(/[a-z0-9]+/g)
        ?.filter((token) => token.length >= 2) || [];
    const tokenMatch = files.find((file) => {
        const fileKey = normalizeKey(file);
        return tokens.length && tokens.every((token) => fileKey.includes(token));
    });

    return tokenMatch ? `/uploads/products/${tokenMatch}` : "";
}

async function migrateProductThumbnails() {
    const rows = await Product.findAll();
    let updated = 0;

    for (const product of rows) {
        const currentUrl = String(product.thumbnail_url || "").trim();
        let nextUrl = currentUrl;

        if (currentUrl.startsWith("/uploads/")) {
            nextUrl = await getAssetUrl(currentUrl);
        }

        if (!nextUrl || nextUrl === currentUrl && currentUrl.startsWith("/uploads/")) {
            const guessedUrl = guessProductImagePath(product);
            if (guessedUrl) nextUrl = await getAssetUrl(guessedUrl);
        }

        if (nextUrl && nextUrl !== currentUrl) {
            product.thumbnail_url = nextUrl;
            await product.save();
            updated += 1;
        }
    }

    console.log(`products.thumbnail_url guessed: ${updated}/${rows.length} updated`);
}

async function main() {
    await sequelize.authenticate();
    await sequelize.sync();

    await migrateModel(Category, "image_url", "categories.image_url");
    await migrateModel(RecipeCategory, "image_url", "recipe_categories.image_url");
    await migrateModel(Product, "thumbnail_url", "products.thumbnail_url");
    await migrateProductThumbnails();
    await migrateModel(ProductImage, "image_url", "product_images.image_url");
    await migrateModel(Recipe, "image_url", "recipes.image_url");
    await migrateModel(RecipeStep, "image_url", "recipe_steps.image_url");

    await sequelize.close();
}

main().catch(async (error) => {
    console.error(error);
    await sequelize.close().catch(() => {});
    process.exit(1);
});
