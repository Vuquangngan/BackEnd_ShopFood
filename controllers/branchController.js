const { Op } = require("sequelize");
const { Branch } = require("../models");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function toPlainBranch(branch) {
    return branch?.get ? branch.get({ plain: true }) : branch;
}

function normalizeStatus(value) {
    return ["active", "paused", "closed"].includes(value) ? value : "active";
}

function normalizeBranchPayload(body = {}, existing = null) {
    const label = String(body.label || body.name || existing?.label || "").trim();
    const key = String(body.key || existing?.key || "").trim();
    const code = String(body.code || existing?.code || "").trim();

    return {
        key,
        code,
        label,
        name: String(body.name || label || existing?.name || "").trim(),
        manager: String(body.manager ?? existing?.manager ?? "").trim(),
        phone: String(body.phone ?? existing?.phone ?? "").trim(),
        city: String(body.city ?? existing?.city ?? "").trim(),
        address: String(body.address ?? existing?.address ?? "").trim(),
        hours: String(body.hours ?? existing?.hours ?? "").trim(),
        image_url: String(body.image_url ?? existing?.image_url ?? "").trim(),
        status: normalizeStatus(body.status || existing?.status)
    };
}

async function buildNextBranchIdentity() {
    const total = await Branch.count();
    let number = total + 1;
    while (await Branch.findOne({ where: { [Op.or]: [{ key: `store_${number}` }, { code: `CN-${String(number).padStart(3, "0")}` }] } })) {
        number += 1;
    }

    return {
        key: `store_${number}`,
        code: `CN-${String(number).padStart(3, "0")}`
    };
}

exports.getBranches = async (_req, res, next) => {
    try {
        const branches = await Branch.findAll({
            order: [["id", "ASC"]]
        });

        return res.json(withCommonResponseAliases({
            branches: branches.map(toPlainBranch)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.createBranch = async (req, res, next) => {
    try {
        const identity = await buildNextBranchIdentity();
        const payload = normalizeBranchPayload({
            ...req.body,
            key: req.body.key || identity.key,
            code: req.body.code || identity.code
        });

        if (!payload.label || !payload.name) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập tên chi nhánh."
            }));
        }

        const branch = await Branch.create(payload);
        return res.status(201).json(withCommonResponseAliases({
            message: "Đã thêm chi nhánh mới.",
            branch: toPlainBranch(branch)
        }));
    } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json(withCommonResponseAliases({
                message: "Mã chi nhánh đã tồn tại."
            }));
        }
        return next(error);
    }
};

exports.updateBranch = async (req, res, next) => {
    try {
        const key = String(req.params.key || "").trim();
        const branch = await Branch.findOne({ where: { key } });
        if (!branch) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy chi nhánh."
            }));
        }

        const payload = normalizeBranchPayload(req.body, toPlainBranch(branch));
        if (!payload.label || !payload.name) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập tên chi nhánh."
            }));
        }

        await branch.update(payload);
        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật chi nhánh.",
            branch: toPlainBranch(branch)
        }));
    } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json(withCommonResponseAliases({
                message: "Mã chi nhánh đã tồn tại."
            }));
        }
        return next(error);
    }
};

exports.deleteBranch = async (req, res, next) => {
    try {
        const key = String(req.params.key || "").trim();
        const deletedCount = await Branch.destroy({ where: { key } });
        if (!deletedCount) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy chi nhánh."
            }));
        }

        return res.json(withCommonResponseAliases({
            message: "Đã xóa chi nhánh."
        }));
    } catch (error) {
        return next(error);
    }
};
