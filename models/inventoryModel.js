const { Op } = require("sequelize");
const {
    sequelize,
    Supplier,
    InventoryDocument,
    InventoryDocumentItem,
    InventoryTransaction,
    Product,
    User
} = require("./index");
const { addVietnameseAliases, addVietnameseLabels } = require("../utils/vietnameseLabels");

const SUPPLIER_FIELDS = [
    "name",
    "code",
    "contact_person",
    "phone",
    "email",
    "address",
    "note",
    "status"
];

const DOCUMENT_FIELDS = [
    "type",
    "supplier_id",
    "reference_number",
    "note"
];

const DOCUMENT_TYPE_CONFIG = {
    receipt: { direction: "in", requiresSupplier: true },
    adjustment_in: { direction: "in", requiresSupplier: false },
    adjustment_out: { direction: "out", requiresSupplier: false },
    damage: { direction: "out", requiresSupplier: false },
    return_supplier: { direction: "out", requiresSupplier: true }
};

function createInventoryError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function toPlain(instance) {
    if (!instance) return null;
    return instance.get ? instance.get({ plain: true }) : instance;
}

function buildDocumentCode(type) {
    const prefixes = {
        receipt: "NK",
        adjustment_in: "NKDC",
        adjustment_out: "XKDC",
        damage: "HH",
        return_supplier: "TRNCC"
    };

    const prefix = prefixes[type] || "KHO";
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

function normalizeItems(items = []) {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => ({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            unit_cost: item.unit_cost === undefined || item.unit_cost === null || item.unit_cost === ""
                ? null
                : Number(item.unit_cost),
            note: item.note ? String(item.note).trim() : null
        }))
        .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
}

function getDocumentConfig(type) {
    const config = DOCUMENT_TYPE_CONFIG[type];
    if (!config) {
        throw createInventoryError("Loai phieu kho khong hop le.");
    }
    return config;
}

function buildNextProductState(product, nextStock) {
    if (product.status === "archived") {
        return {
            stock_quantity: nextStock,
            status: "archived"
        };
    }

    if (nextStock <= 0) {
        return {
            stock_quantity: 0,
            status: "out_of_stock"
        };
    }

    if (!product.is_published) {
        return {
            stock_quantity: nextStock,
            status: "draft"
        };
    }

    return {
        stock_quantity: nextStock,
        status: "active"
    };
}

function localizeSupplier(supplier) {
    if (!supplier) return null;

    const localized = addVietnameseLabels(supplier, {
        status: "supplier_status"
    });

    return addVietnameseAliases(localized, {
        contact_person: "nguoi_lien_he",
        phone: "so_dien_thoai",
        email: "email_nha_cung_cap",
        address: "dia_chi",
        note: "ghi_chu",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

function localizeDocumentItem(item) {
    if (!item) return null;

    return addVietnameseAliases(item, {
        document_id: "ma_phieu_kho",
        product_id: "ma_san_pham",
        quantity: "so_luong",
        unit_cost: "don_gia_nhap",
        line_total: "thanh_tien",
        note: "ghi_chu"
    });
}

function localizeDocument(document) {
    if (!document) return null;

    const localized = addVietnameseLabels(document, {
        type: "inventory_document_type",
        status: "inventory_document_status"
    });

    const supplier = localizeSupplier(localized.supplier);
    const items = (localized.items || []).map(localizeDocumentItem);

    return {
        ...addVietnameseAliases(localized, {
            reference_number: "so_chung_tu",
            supplier_id: "ma_nha_cung_cap",
            created_by: "ma_nguoi_tao",
            approved_by: "ma_nguoi_duyet",
            type: "loai_phieu_ma",
            type_label: "loai_phieu_hien_thi",
            status: "trang_thai_ma",
            status_label: "trang_thai_hien_thi",
            total_quantity: "tong_so_luong",
            total_amount: "tong_tien",
            completed_at: "thoi_gian_hoan_tat",
            note: "ghi_chu",
            supplier: "nha_cung_cap",
            items: "chi_tiet_phieu",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        supplier,
        nha_cung_cap: supplier,
        items,
        chi_tiet_phieu: items
    };
}

function localizeTransaction(transaction) {
    if (!transaction) return null;

    const localized = addVietnameseLabels(transaction, {
        movement_type: "inventory_transaction_type",
        direction: "inventory_direction"
    });

    return addVietnameseAliases(localized, {
        document_id: "ma_phieu_kho",
        product_id: "ma_san_pham",
        reference_type: "loai_tham_chieu",
        reference_id: "ma_tham_chieu",
        movement_type: "loai_giao_dich_ma",
        movement_type_label: "loai_giao_dich_hien_thi",
        direction: "huong_giao_dich_ma",
        direction_label: "huong_giao_dich_hien_thi",
        quantity: "so_luong",
        stock_before: "ton_truoc",
        stock_after: "ton_sau",
        unit_cost: "don_gia",
        note: "ghi_chu",
        created_by: "ma_nguoi_tao",
        created_at: "ngay_tao"
    });
}

async function fetchProductsForItems(items, transaction) {
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const products = await Product.findAll({
        where: { id: { [Op.in]: productIds } },
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (products.length !== productIds.length) {
        throw createInventoryError("Co san pham trong phieu kho khong ton tai.");
    }

    return new Map(products.map((product) => [Number(product.id), product]));
}

async function ensureSupplier(documentPayload, transaction) {
    const config = getDocumentConfig(documentPayload.type);
    if (!config.requiresSupplier) return null;

    if (!documentPayload.supplier_id) {
        throw createInventoryError("Loai phieu kho nay bat buoc phai chon nha cung cap.");
    }

    const supplier = await Supplier.findByPk(documentPayload.supplier_id, { transaction });
    if (!supplier) {
        throw createInventoryError("Nha cung cap khong ton tai.");
    }

    if (supplier.status !== "active") {
        throw createInventoryError("Nha cung cap hien khong hoat dong.");
    }

    return supplier;
}

async function applyInventoryMovements({ document, items, actorId, transaction }) {
    const config = getDocumentConfig(document.type);
    const productsById = await fetchProductsForItems(items, transaction);

    for (const item of items) {
        const product = productsById.get(item.product_id);
        const stockBefore = Number(product.stock_quantity);
        const nextStock = config.direction === "in"
            ? stockBefore + item.quantity
            : stockBefore - item.quantity;

        if (config.direction === "out" && nextStock < 0) {
            throw createInventoryError(`San pham ${product.name} khong du ton kho de xu ly.`);
        }

        const nextState = buildNextProductState(product, nextStock);

        await InventoryTransaction.create({
            product_id: product.id,
            document_id: document.id,
            reference_type: "inventory_document",
            reference_id: document.id,
            movement_type: document.type,
            direction: config.direction,
            quantity: item.quantity,
            stock_before: stockBefore,
            stock_after: nextState.stock_quantity,
            unit_cost: item.unit_cost,
            note: item.note || document.note || null,
            created_by: actorId || null
        }, { transaction });

        await product.update(nextState, { transaction });
    }
}

async function attachDocumentDetails(id, transaction) {
    return InventoryDocument.findByPk(id, {
        include: [
            {
                model: Supplier,
                as: "supplier"
            },
            {
                model: User,
                as: "creator",
                attributes: ["id", "username", "email", "role"]
            },
            {
                model: User,
                as: "approver",
                attributes: ["id", "username", "email", "role"]
            },
            {
                model: InventoryDocumentItem,
                as: "items",
                include: [
                    {
                        model: Product,
                        as: "product",
                        attributes: ["id", "name", "sku", "stock_quantity", "status", "is_published"]
                    }
                ],
                separate: true,
                order: [["id", "ASC"]]
            }
        ],
        transaction
    });
}

const InventoryModel = {
    buildNextProductState,

    async listSuppliers(filters = {}) {
        const where = {};

        if (filters.status) where.status = filters.status;
        if (filters.keyword) {
            where[Op.or] = [
                { name: { [Op.like]: `%${filters.keyword}%` } },
                { code: { [Op.like]: `%${filters.keyword}%` } },
                { contact_person: { [Op.like]: `%${filters.keyword}%` } },
                { phone: { [Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const suppliers = await Supplier.findAll({
            where,
            order: [["created_at", "DESC"]]
        });

        return suppliers.map((supplier) => localizeSupplier(toPlain(supplier)));
    },

    async getSupplierById(id) {
        const supplier = await Supplier.findByPk(id);
        return localizeSupplier(toPlain(supplier));
    },

    async createSupplier(data) {
        const payload = {};
        SUPPLIER_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                payload[field] = data[field];
            }
        });

        const supplier = await Supplier.create(payload);
        return this.getSupplierById(supplier.id);
    },

    async updateSupplier(id, data) {
        const supplier = await Supplier.findByPk(id);
        if (!supplier) return null;

        const payload = {};
        SUPPLIER_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                payload[field] = data[field];
            }
        });

        await supplier.update(payload);
        return this.getSupplierById(id);
    },

    async removeSupplier(id) {
        const deletedRows = await Supplier.destroy({ where: { id } });
        return deletedRows > 0;
    },

    async listDocuments(filters = {}) {
        const where = {};

        if (filters.type) where.type = filters.type;
        if (filters.status) where.status = filters.status;
        if (filters.supplier_id) where.supplier_id = Number(filters.supplier_id);

        const documents = await InventoryDocument.findAll({
            where,
            include: [
                {
                    model: Supplier,
                    as: "supplier"
                }
            ],
            order: [["created_at", "DESC"]]
        });

        return documents.map((document) => localizeDocument(toPlain(document)));
    },

    async getDocumentById(id) {
        const document = await attachDocumentDetails(id);
        return localizeDocument(toPlain(document));
    },

    async createDocument(data, actor) {
        const items = normalizeItems(data.items);
        if (!items.length) {
            throw createInventoryError("Phieu kho phai co it nhat mot san pham.");
        }

        const payload = {};
        DOCUMENT_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                payload[field] = data[field];
            }
        });

        await ensureSupplier(payload, null);

        let documentId;
        const autoComplete = data.auto_complete !== false;

        await sequelize.transaction(async (transaction) => {
            await ensureSupplier(payload, transaction);
            await fetchProductsForItems(items, transaction);

            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            const totalAmount = items.reduce((sum, item) => sum + ((item.unit_cost || 0) * item.quantity), 0);

            const document = await InventoryDocument.create({
                ...payload,
                code: buildDocumentCode(payload.type),
                created_by: actor.id,
                total_quantity: totalQuantity,
                total_amount: Number(totalAmount.toFixed(2)),
                status: autoComplete ? "completed" : "draft",
                approved_by: autoComplete ? actor.id : null,
                completed_at: autoComplete ? new Date() : null
            }, { transaction });

            documentId = document.id;

            await InventoryDocumentItem.bulkCreate(
                items.map((item) => ({
                    document_id: document.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    line_total: Number(((item.unit_cost || 0) * item.quantity).toFixed(2)),
                    note: item.note || null
                })),
                { transaction }
            );

            if (autoComplete) {
                await applyInventoryMovements({
                    document,
                    items,
                    actorId: actor.id,
                    transaction
                });
            }
        });

        return this.getDocumentById(documentId);
    },

    async completeDocument(id, actor) {
        let resultId = null;

        await sequelize.transaction(async (transaction) => {
            const document = await InventoryDocument.findByPk(id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!document) {
                throw createInventoryError("Khong tim thay phieu kho.", 404);
            }

            if (document.status === "completed") {
                resultId = document.id;
                return;
            }

            if (document.status === "cancelled") {
                throw createInventoryError("Phieu kho da huy nen khong the hoan tat.");
            }

            await ensureSupplier(document, transaction);

            const items = await InventoryDocumentItem.findAll({
                where: { document_id: document.id },
                transaction
            });

            if (!items.length) {
                throw createInventoryError("Phieu kho khong co san pham de hoan tat.");
            }

            await applyInventoryMovements({
                document,
                items,
                actorId: actor.id,
                transaction
            });

            await document.update({
                status: "completed",
                approved_by: actor.id,
                completed_at: new Date()
            }, { transaction });

            resultId = document.id;
        });

        return this.getDocumentById(resultId);
    },

    async cancelDocument(id) {
        const document = await InventoryDocument.findByPk(id);
        if (!document) return null;

        if (document.status === "completed") {
            throw createInventoryError("Khong the huy phieu kho da hoan tat.");
        }

        await document.update({
            status: "cancelled"
        });

        return this.getDocumentById(id);
    },

    async listTransactions(filters = {}) {
        const where = {};

        if (filters.product_id) where.product_id = Number(filters.product_id);
        if (filters.document_id) where.document_id = Number(filters.document_id);
        if (filters.movement_type) where.movement_type = filters.movement_type;
        if (filters.reference_type) where.reference_type = filters.reference_type;
        if (filters.reference_id) where.reference_id = Number(filters.reference_id);

        const transactions = await InventoryTransaction.findAll({
            where,
            include: [
                {
                    model: Product,
                    as: "product",
                    attributes: ["id", "name", "sku"]
                },
                {
                    model: InventoryDocument,
                    as: "document",
                    attributes: ["id", "code", "type", "status"]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        return transactions.map((item) => localizeTransaction(toPlain(item)));
    },

    async recordSaleTransaction({ product, quantity, orderId, userId, note, transaction }) {
        const stockAfter = Number(product.stock_quantity);
        const stockBefore = stockAfter + Number(quantity);

        await InventoryTransaction.create({
            product_id: product.id,
            document_id: null,
            reference_type: "order",
            reference_id: orderId,
            movement_type: "sale",
            direction: "out",
            quantity: Number(quantity),
            stock_before: stockBefore,
            stock_after: stockAfter,
            unit_cost: product.sale_price || product.price || null,
            note: note || `Ban hang tu don ${orderId}`,
            created_by: userId || null
        }, { transaction });
    }
};

module.exports = InventoryModel;
