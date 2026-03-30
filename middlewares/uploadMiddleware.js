const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

function ensureDirectoryExists(directoryPath) {
    fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeFolder(rawFolder) {
    const folder = String(rawFolder || "general")
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "");

    return folder || "general";
}

function getUploadFolder(req) {
    const folder = normalizeFolder(req.query.folder);
    const directoryPath = path.join(UPLOAD_ROOT, folder);

    ensureDirectoryExists(directoryPath);
    req.uploadFolder = folder;

    return directoryPath;
}

function getSafeExtension(file) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    return extension || ".jpg";
}

const storage = multer.diskStorage({
    destination(req, file, callback) {
        try {
            callback(null, getUploadFolder(req));
        } catch (error) {
            callback(error);
        }
    },
    filename(req, file, callback) {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${getSafeExtension(file)}`;
        callback(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: (Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 5) || 5) * 1024 * 1024
    },
    fileFilter(req, file, callback) {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            const error = new Error("Chỉ chấp nhận tệp ảnh JPG, PNG, WEBP hoặc GIF.");
            error.status = 400;
            return callback(error);
        }

        return callback(null, true);
    }
});

ensureDirectoryExists(UPLOAD_ROOT);

module.exports = {
    uploadImageFields: upload.fields([
        { name: "image", maxCount: 1 },
        { name: "images", maxCount: 10 }
    ]),
    UPLOAD_ROOT
};