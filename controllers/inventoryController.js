const Inventory = require("../models/inventoryModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.code === "ER_DUP_ENTRY") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma hoac thong tin ton tai bi trung lap."
        }));
    }

    if (error.name === "SequelizeForeignKeyConstraintError" || error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Du lieu lien ket khong ton tai."
        }));
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json(withCommonResponseAliases({
            message: error.message
        }));
    }

    return res.status(500).json(withCommonResponseAliases({
        message: error.message || "Da xay ra loi may chu."
    }));
}

exports.getSuppliers = async (req, res) => {
    try {
        return res.json(await Inventory.listSuppliers(req.query));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getSupplierById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma nha cung cap khong hop le." }));
        }

        const supplier = await Inventory.getSupplierById(id);
        if (!supplier) {
            return res.status(404).json(withCommonResponseAliases({ message: "Khong tim thay nha cung cap." }));
        }

        return res.json(supplier);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name || !code) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui long nhap day du ten nha cung cap va ma nha cung cap."
            }));
        }

        const supplier = await Inventory.createSupplier(req.body);
        return res.status(201).json(supplier);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma nha cung cap khong hop le." }));
        }

        const supplier = await Inventory.updateSupplier(id, req.body);
        if (!supplier) {
            return res.status(404).json(withCommonResponseAliases({ message: "Khong tim thay nha cung cap." }));
        }

        return res.json(supplier);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.removeSupplier = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma nha cung cap khong hop le." }));
        }

        const deleted = await Inventory.removeSupplier(id);
        if (!deleted) {
            return res.status(404).json(withCommonResponseAliases({ message: "Khong tim thay nha cung cap." }));
        }

        return res.json(withCommonResponseAliases({ message: "Xoa nha cung cap thanh cong." }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getDocuments = async (req, res) => {
    try {
        return res.json(await Inventory.listDocuments(req.query));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getDocumentById = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma phieu kho khong hop le." }));
        }

        const document = await Inventory.getDocumentById(id);
        if (!document) {
            return res.status(404).json(withCommonResponseAliases({ message: "Khong tim thay phieu kho." }));
        }

        return res.json(document);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.createDocument = async (req, res) => {
    try {
        const { type, items } = req.body;
        if (!type) {
            return res.status(400).json(withCommonResponseAliases({ message: "Vui long chon loai phieu kho." }));
        }

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json(withCommonResponseAliases({ message: "Phieu kho phai co it nhat mot san pham." }));
        }

        const document = await Inventory.createDocument(req.body, req.user);
        return res.status(201).json(document);
    } catch (error) {
        return handleError(res, error);
    }
};

exports.completeDocument = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma phieu kho khong hop le." }));
        }

        const document = await Inventory.completeDocument(id, req.user);
        return res.json(withCommonResponseAliases({
            message: "Hoan tat phieu kho thanh cong.",
            document,
            phieu_kho: document
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.cancelDocument = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json(withCommonResponseAliases({ message: "Ma phieu kho khong hop le." }));
        }

        const document = await Inventory.cancelDocument(id);
        if (!document) {
            return res.status(404).json(withCommonResponseAliases({ message: "Khong tim thay phieu kho." }));
        }

        return res.json(withCommonResponseAliases({
            message: "Huy phieu kho thanh cong.",
            document,
            phieu_kho: document
        }));
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getTransactions = async (req, res) => {
    try {
        return res.json(await Inventory.listTransactions(req.query));
    } catch (error) {
        return handleError(res, error);
    }
};
