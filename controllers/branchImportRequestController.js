const { Op } = require("sequelize");
const {
    sequelize,
    Branch,
    BranchImportRequest,
    BranchImportRequestItem,
    Product
} = require("../models");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const VALID_STATUSES = new Set(["draft", "pending", "approved", "receiving", "completed", "rejected"]);

function plain(record) {
    return record?.get ? record.get({ plain: true }) : record;
}

function normalizeQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeDateOnly(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function mapRequest(request) {
    const data = plain(request);
    return {
        ...data,
        items: (data.items || []).map((item) => ({
            ...item,
            quantity: Number(item.quantity || 0)
        }))
    };
}

function getStatusPatch(status) {
    const now = new Date();
    const messages = {
        draft: "Đã lưu nháp yêu cầu gửi hàng.",
        pending: "Đã gửi yêu cầu chờ duyệt.",
        approved: "Đã duyệt yêu cầu gửi hàng.",
        receiving: "Đã chuyển sang trạng thái đang gửi hàng.",
        completed: "Đã hoàn tất gửi hàng cho chi nhánh.",
        rejected: "Đã từ chối yêu cầu gửi hàng."
    };

    return {
        status,
        status_note: messages[status] || "",
        ...(status === "approved" ? { approved_at: now } : {}),
        ...(status === "receiving" ? { shipped_at: now } : {}),
        ...(status === "completed" ? { completed_at: now } : {}),
        ...(status === "rejected" ? { rejected_at: now } : {})
    };
}

async function findBranch(branchKeyOrId) {
    const raw = String(branchKeyOrId || "").trim();
    if (!raw) return null;
    const numericId = Number(raw);
    return Branch.findOne({
        where: Number.isInteger(numericId) && numericId > 0
            ? { [Op.or]: [{ id: numericId }, { key: raw }] }
            : { key: raw }
    });
}

async function buildNextCode(branch, transaction) {
    const count = await BranchImportRequest.count({
        where: { branch_id: branch.id },
        transaction
    });
    const branchNumber = String(branch.code || branch.id || "CN").replace(/\D/g, "").slice(-2) || String(branch.id).padStart(2, "0");
    return `REQ-CN${branchNumber.padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;
}

async function getRequestById(id) {
    return BranchImportRequest.findByPk(id, {
        include: [
            { model: Branch, as: "branch" },
            {
                model: BranchImportRequestItem,
                as: "items",
                include: [{ model: Product, as: "product" }]
            }
        ],
        order: [[{ model: BranchImportRequestItem, as: "items" }, "id", "ASC"]]
    });
}

exports.list = async (req, res, next) => {
    try {
        const where = {};
        const branchKey = String(req.query.branch_key || "").trim();
        const status = String(req.query.status || "").trim();
        if (branchKey && branchKey !== "all") where.branch_key = branchKey;
        if (status && status !== "all" && VALID_STATUSES.has(status)) where.status = status;

        const requests = await BranchImportRequest.findAll({
            where,
            include: [
                { model: Branch, as: "branch" },
                {
                    model: BranchImportRequestItem,
                    as: "items",
                    include: [{ model: Product, as: "product" }]
                }
            ],
            order: [["created_at", "DESC"], [{ model: BranchImportRequestItem, as: "items" }, "id", "ASC"]]
        });

        return res.json(withCommonResponseAliases({
            requests: requests.map(mapRequest)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const branch = await findBranch(req.body.branch_key || req.body.branch_id);
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (!branch) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Chi nhánh không tồn tại."
            }));
        }
        if (!items.length) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Phiếu yêu cầu cần ít nhất một sản phẩm."
            }));
        }

        const status = req.body.status === "draft" || req.body.as_draft === true ? "draft" : "pending";
        const request = await sequelize.transaction(async (transaction) => {
            const code = await buildNextCode(branch, transaction);
            const created = await BranchImportRequest.create({
                code,
                branch_id: branch.id,
                branch_key: branch.key,
                branch_name: req.body.branch_name || [branch.label, branch.name !== branch.label ? branch.name : ""].filter(Boolean).join(" - ") || branch.name,
                expected_date: normalizeDateOnly(req.body.expected_date),
                note: String(req.body.note || "").trim(),
                status,
                status_note: status === "draft" ? "Đã lưu nháp yêu cầu gửi hàng." : "Đã gửi yêu cầu chờ duyệt.",
                created_by: req.user?.id || null
            }, { transaction });

            await BranchImportRequestItem.bulkCreate(items.map((item) => ({
                request_id: created.id,
                product_id: Number(item.product_id),
                name: String(item.name || "Sản phẩm").trim(),
                sku: String(item.sku || "").trim(),
                thumbnail_url: String(item.thumbnail_url || "").trim(),
                unit: String(item.unit || "đơn vị").trim(),
                quantity: normalizeQuantity(item.quantity)
            })).filter((item) => item.product_id > 0), { transaction });

            return created;
        });

        const saved = await getRequestById(request.id);
        return res.status(201).json(withCommonResponseAliases({
            message: status === "draft" ? "Đã lưu nháp yêu cầu gửi hàng." : "Đã gửi yêu cầu gửi hàng.",
            request: mapRequest(saved)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const request = await BranchImportRequest.findByPk(id);
        if (!request) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy phiếu yêu cầu gửi hàng."
            }));
        }

        const patch = {};
        const status = String(req.body.status || "").trim();
        if (status) {
            if (!VALID_STATUSES.has(status)) {
                return res.status(400).json(withCommonResponseAliases({
                    message: "Trạng thái phiếu yêu cầu không hợp lệ."
                }));
            }
            Object.assign(patch, getStatusPatch(status));
        }
        if (req.body.note !== undefined) patch.note = String(req.body.note || "").trim();
        if (req.body.expected_date !== undefined) patch.expected_date = normalizeDateOnly(req.body.expected_date);

        await request.update(patch);

        if (Array.isArray(req.body.items)) {
            await sequelize.transaction(async (transaction) => {
                for (const item of req.body.items) {
                    await BranchImportRequestItem.update({
                        quantity: normalizeQuantity(item.quantity)
                    }, {
                        where: {
                            request_id: request.id,
                            product_id: Number(item.product_id)
                        },
                        transaction
                    });
                }
            });
        }

        const saved = await getRequestById(request.id);
        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật phiếu yêu cầu gửi hàng.",
            request: mapRequest(saved)
        }));
    } catch (error) {
        return next(error);
    }
};

exports.updateItem = async (req, res, next) => {
    try {
        const requestId = Number(req.params.id);
        const productId = Number(req.params.productId);
        const item = await BranchImportRequestItem.findOne({
            where: { request_id: requestId, product_id: productId }
        });
        if (!item) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy sản phẩm trong phiếu yêu cầu."
            }));
        }
        await item.update({ quantity: normalizeQuantity(req.body.quantity) });
        const request = await getRequestById(requestId);
        return res.json(withCommonResponseAliases({
            message: "Đã cập nhật số lượng sản phẩm trong phiếu.",
            request: mapRequest(request)
        }));
    } catch (error) {
        return next(error);
    }
};
