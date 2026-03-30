const { addVietnameseAliases } = require("../utils/vietnameseLabels");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function collectFiles(req) {
    const fileGroups = req.files || {};

    return [
        ...(fileGroups.image || []),
        ...(fileGroups.images || [])
    ];
}

function toPublicUrl(req, file) {
    const folder = req.uploadFolder || "general";
    const relativeUrl = `/uploads/${folder}/${file.filename}`;

    return {
        url: `${req.protocol}://${req.get("host")}${relativeUrl}`,
        relativeUrl,
        folder
    };
}

function localizeUploadedFile(req, file) {
    const publicUrl = toPublicUrl(req, file);

    return addVietnameseAliases({
        original_name: file.originalname,
        file_name: file.filename,
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

exports.uploadImages = (req, res) => {
    const files = collectFiles(req);

    if (!files.length) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui lòng chọn ít nhất một tệp ảnh để tải lên."
        }));
    }

    const uploadedFiles = files.map((file) => localizeUploadedFile(req, file));

    return res.status(201).json(withCommonResponseAliases({
        message: `Tải lên thành công ${uploadedFiles.length} ảnh.`,
        files: uploadedFiles,
        tep_tin: uploadedFiles,
        file: uploadedFiles[0],
        hinh_anh: uploadedFiles[0]
    }));
};