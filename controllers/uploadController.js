const { addVietnameseAliases } = require("../utils/vietnameseLabels");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { MediaAsset } = require("../models");

function collectFiles(req) {
    const fileGroups = req.files || {};

    return [
        ...(fileGroups.image || []),
        ...(fileGroups.images || [])
    ];
}

function toPublicUrl(req, file, asset) {
    const folder = req.uploadFolder || "general";
    const relativeUrl = asset?.id ? `/api/uploads/assets/${asset.id}` : `/uploads/${folder}/${file.filename}`;

    return {
        url: `${req.protocol}://${req.get("host")}${relativeUrl}`,
        relativeUrl,
        folder
    };
}

async function localizeUploadedFile(req, file) {
    const folder = req.uploadFolder || "general";
    const asset = await MediaAsset.create({
        folder,
        original_name: file.originalname || "",
        file_name: `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname || "image"}`,
        mime_type: file.mimetype,
        size: file.size || file.buffer?.length || 0,
        data: file.buffer
    });
    const publicUrl = toPublicUrl(req, file, asset);

    return addVietnameseAliases({
        id: asset.id,
        original_name: file.originalname,
        file_name: asset.file_name,
        mime_type: file.mimetype,
        size: file.size,
        folder: publicUrl.folder,
        relative_url: publicUrl.relativeUrl,
        url: publicUrl.url
    }, {
        original_name: "ten_goc",
        file_name: "ten_tap_tin",
        mime_type: "loai_tap_tin",
        size: "kich_thuoc_byte",
        folder: "thu_muc",
        relative_url: "duong_dan_tuong_doi",
        url: "duong_dan"
    });
}

exports.uploadImages = async (req, res) => {
    const files = collectFiles(req);

    if (!files.length) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui lòng chọn ít nhất một tệp ảnh để tải lên."
        }));
    }

    const uploadedFiles = await Promise.all(files.map((file) => localizeUploadedFile(req, file)));

    return res.status(201).json(withCommonResponseAliases({
        message: `Tải lên thành công ${uploadedFiles.length} ảnh.`,
        files: uploadedFiles,
        tep_tin: uploadedFiles,
        file: uploadedFiles[0],
        hinh_anh: uploadedFiles[0]
    }));
};

exports.getAsset = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json(withCommonResponseAliases({ message: "Mã ảnh không hợp lệ." }));
    }

    const asset = await MediaAsset.findByPk(id);
    if (!asset) {
        return res.status(404).json(withCommonResponseAliases({ message: "Không tìm thấy ảnh." }));
    }

    res.setHeader("Content-Type", asset.mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(asset.data);
};
