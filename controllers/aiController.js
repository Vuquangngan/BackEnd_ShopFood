const { Op } = require("sequelize");
const { Product, Category, Recipe, Coupon } = require("../models");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function sendError(res, status, message) {
    return res.status(status).json(withCommonResponseAliases({ message }));
}

function cleanText(value, maxLength = 4000) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

async function buildShopContext() {
    const [products, categories, recipes, coupons] = await Promise.all([
        Product.findAll({
            where: {
                status: { [Op.ne]: "archived" }
            },
            attributes: ["name", "sku", "price", "sale_price", "stock_quantity", "stock_unit", "short_description", "is_published", "status"],
            include: [{ model: Category, as: "category", attributes: ["name"] }],
            order: [["updated_at", "DESC"]],
            limit: 30
        }),
        Category.findAll({
            attributes: ["name", "description"],
            order: [["name", "ASC"]],
            limit: 30
        }),
        Recipe.findAll({
            attributes: ["title", "description", "difficulty", "prep_time_minutes", "cook_time_minutes", "status"],
            order: [["updated_at", "DESC"]],
            limit: 12
        }),
        Coupon.findAll({
            where: { is_active: true },
            attributes: ["code", "description", "discount_type", "discount_value", "min_order_value"],
            order: [["updated_at", "DESC"]],
            limit: 10
        })
    ]);

    return [
        "Dữ liệu hiện có của Garden Fresh:",
        "Danh mục: " + categories.map((item) => item.name).filter(Boolean).join(", "),
        "Sản phẩm:",
        ...products.map((item) => {
            const price = Number(item.sale_price || item.price || 0);
            const stock = Number(item.stock_quantity || 0);
            return `- ${item.name} (${item.sku || "không SKU"}), danh mục ${item.category?.name || "khác"}, giá ${price}đ, tồn ${stock} ${item.stock_unit || ""}, trạng thái ${item.status || ""}. ${item.short_description || ""}`;
        }),
        "Công thức:",
        ...recipes.map((item) => `- ${item.title}: ${item.description || ""} (${item.difficulty || "dễ"}, ${Number(item.prep_time_minutes || 0) + Number(item.cook_time_minutes || 0)} phút)`),
        "Voucher đang hoạt động:",
        ...coupons.map((item) => `- ${item.code}: ${item.description || ""}, giảm ${item.discount_value}${item.discount_type === "percent" ? "%" : "đ"}, đơn tối thiểu ${item.min_order_value || 0}đ`)
    ].join("\n");
}

async function askGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const error = new Error("Chưa cấu hình GEMINI_API_KEY trong backend.");
        error.status = 503;
        throw error;
    }

    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 700
            }
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || "Gemini chưa phản hồi được yêu cầu.";
        const error = new Error(message);
        error.status = response.status >= 500 ? 502 : response.status;
        throw error;
    }

    const answer = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        ?.filter(Boolean)
        ?.join("\n")
        ?.trim();

    if (!answer) {
        const error = new Error("Gemini không trả về nội dung trả lời.");
        error.status = 502;
        throw error;
    }

    return answer;
}

exports.askSupport = async (req, res) => {
    try {
        const message = cleanText(req.body?.message, 1200);
        if (!message) {
            return sendError(res, 400, "Vui lòng nhập nội dung cần hỗ trợ.");
        }

        const context = await buildShopContext();
        const prompt = [
            "Bạn là trợ lý AI của Garden Fresh, một ứng dụng bán thực phẩm tươi, công thức nấu ăn và quản lý đơn hàng.",
            "Trả lời bằng tiếng Việt có dấu, thân thiện, ngắn gọn, ưu tiên hướng dẫn rõ từng bước.",
            "Nếu người dùng hỏi về đơn hàng cá nhân, thanh toán, hoàn tiền hoặc thông tin riêng tư mà bạn không có dữ liệu cụ thể, hãy hướng dẫn họ liên hệ nhân viên hỗ trợ trong app.",
            "Không bịa tồn kho, giá, voucher hoặc chính sách nếu dữ liệu không có trong phần ngữ cảnh.",
            context,
            `Câu hỏi của người dùng: ${message}`
        ].join("\n\n");

        const answer = await askGemini(prompt);
        return res.json(withCommonResponseAliases({
            answer,
            model: DEFAULT_MODEL
        }));
    } catch (error) {
        return sendError(res, error.status || 500, error.message || "Không thể gọi trợ lý AI lúc này.");
    }
};
