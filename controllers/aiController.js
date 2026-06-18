const { Op } = require("sequelize");
const {
    Product,
    Category,
    Recipe,
    RecipeCategory,
    RecipeIngredient,
    RecipeStep,
    Coupon
} = require("../models");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
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

function formatRecipeForAi(recipe) {
    const time = Number(recipe.prep_time_minutes || 0) + Number(recipe.cook_time_minutes || 0);
    const ingredients = (recipe.ingredients || [])
        .map((ingredient) => {
            const name = ingredient.product?.name || ingredient.ingredient_name;
            const quantity = ingredient.quantity ? `${ingredient.quantity} ${ingredient.unit || ""}`.trim() : "";
            const note = ingredient.note ? `, ${ingredient.note}` : "";
            return `${name}${quantity ? ` (${quantity}${note})` : note}`;
        })
        .filter(Boolean)
        .join("; ");
    const steps = (recipe.steps || [])
        .map((step) => `${step.step_number || ""}. ${step.instruction || ""}`.trim())
        .filter(Boolean)
        .join(" ");

    return [
        `- ${recipe.title}: ${recipe.description || ""}`,
        `Danh mục: ${recipe.recipe_category?.name || "khác"}. Độ khó: ${recipe.difficulty || "dễ"}. Thời gian: ${time} phút. Trạng thái: ${recipe.status || ""}.`,
        ingredients ? `Nguyên liệu: ${ingredients}.` : "",
        steps ? `Cách làm: ${steps}` : ""
    ].filter(Boolean).join(" ");
}

async function buildShopContext() {
    const [products, categories, recipes, coupons] = await Promise.all([
        Product.findAll({
            where: {
                status: { [Op.ne]: "archived" }
            },
            attributes: ["name", "price", "sale_price", "stock_quantity", "stock_unit", "short_description", "is_published", "status"],
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
            include: [
                {
                    model: RecipeCategory,
                    as: "recipe_category",
                    attributes: ["name"]
                },
                {
                    model: RecipeIngredient,
                    as: "ingredients",
                    attributes: ["ingredient_name", "quantity", "unit", "note", "sort_order"],
                    separate: true,
                    order: [["sort_order", "ASC"], ["id", "ASC"]],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["name"]
                        }
                    ]
                },
                {
                    model: RecipeStep,
                    as: "steps",
                    attributes: ["step_number", "instruction"],
                    separate: true,
                    order: [["step_number", "ASC"], ["id", "ASC"]]
                }
            ],
            order: [["updated_at", "DESC"]],
            limit: 30
        }),
        Coupon.findAll({
            where: { is_active: true },
            attributes: ["code", "description", "discount_type", "discount_value", "min_order_value"],
            order: [["updated_at", "DESC"]],
            limit: 10
        })
    ]);

    const recipeContextLines = recipes.map((item) => formatRecipeForAi(item));

    return [
        "Chi tiết công thức có trong hệ thống:",
        ...recipeContextLines,
        "Dữ liệu hiện có của FOODIFI:",
        "Danh mục: " + categories.map((item) => item.name).filter(Boolean).join(", "),
        "Sản phẩm:",
        ...products.map((item) => {
            const price = Number(item.sale_price || item.price || 0);
            const stock = Number(item.stock_quantity || 0);
            return `- ${item.name}, danh mục ${item.category?.name || "khác"}, giá ${price}đ, tồn ${stock} ${item.stock_unit || ""}, trạng thái ${item.status || ""}. ${item.short_description || ""}`;
        }),
        "Công thức:",
        ...recipes.map((item) => `- ${item.title}: ${item.description || ""} (${item.difficulty || "dễ"}, ${Number(item.prep_time_minutes || 0) + Number(item.cook_time_minutes || 0)} phút)`),
        "Voucher đang hoạt động:",
        ...coupons.map((item) => `- ${item.code}: ${item.description || ""}, giảm ${item.discount_value}${item.discount_type === "percent" ? "%" : "đ"}, đơn tối thiểu ${item.min_order_value || 0}đ`)
    ].join("\n");
}

async function askGemini(prompt, image) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const error = new Error("Chưa cấu hình GEMINI_API_KEY trong backend.");
        error.status = 503;
        throw error;
    }

    const parts = [{ text: prompt }];
    if (image && image.data) {
        parts.push({
            inlineData: {
                mimeType: image.mimeType || "image/jpeg",
                data: image.data
            }
        });
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
                    parts
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
        const rawImageData = typeof req.body?.image_base64 === "string"
            ? req.body.image_base64.trim()
            : "";
        const imageMime = typeof req.body?.image_mime_type === "string" && req.body.image_mime_type.trim()
            ? req.body.image_mime_type.trim()
            : "image/jpeg";
        const image = rawImageData
            ? { mimeType: imageMime, data: rawImageData.replace(/^data:[^,]+,/, "") }
            : null;

        console.log("[ai/support] message len=%d hasImage=%s imageBytes=%d mime=%s",
            message.length,
            !!image,
            image ? image.data.length : 0,
            image ? image.mimeType : "-"
        );

        if (!message && !image) {
            return sendError(res, 400, "Vui lòng nhập nội dung hoặc gửi ảnh cần hỗ trợ.");
        }

        const userQuestion = message || "Người dùng gửi ảnh mà chưa kèm câu hỏi. Hãy nhận diện món ăn/sản phẩm trong ảnh, mô tả ngắn và đối chiếu xem cửa hàng có nguyên liệu/sản phẩm phù hợp không.";

        const context = await buildShopContext();
        const promptLines = [
            "Dinh dang cau tra loi de hien thi dep trong khung chat: khong tra ve HTML, han che Markdown **...**. Khi tra loi ve mon an/cong thuc, dung mau: dong chao ngan; duong phan cach bang --------; tieu de in hoa co emoji nhu 📌 THONG TIN MON AN, 📝 MO TA, 🥬 NGUYEN LIEU, 👨‍🍳 CACH LAM; cac muc dung bullet • moi muc mot dong.",
            "Bạn là trợ lý AI của FOODIFI, một ứng dụng bán thực phẩm tươi, công thức nấu ăn và quản lý đơn hàng.",
            "Trả lời bằng tiếng Việt có dấu, thân thiện, ngắn gọn, ưu tiên hướng dẫn rõ từng bước.",
            "Nếu người dùng hỏi về đơn hàng cá nhân, thanh toán, hoàn tiền hoặc thông tin riêng tư mà bạn không có dữ liệu cụ thể, hãy hướng dẫn họ liên hệ nhân viên hỗ trợ trong app.",
            "Không bịa tồn kho, giá, voucher hoặc chính sách nếu dữ liệu không có trong phần ngữ cảnh.",
            "Khi nhắc đến sản phẩm/nguyên liệu, chỉ ghi TÊN sản phẩm. Tuyệt đối KHÔNG hiển thị mã SKU, mã code, ID, hoặc bất kỳ định danh kỹ thuật nào (ví dụ không viết \"SKU-BO-002\", \"(SKU-...)\", \"mã ABC\")."
        ];
        if (image) {
            promptLines.push(
                "Người dùng đã gửi kèm một ảnh. Hãy phân tích ảnh: nhận diện món ăn/sản phẩm, liệt kê các nguyên liệu thường gặp, rồi đối chiếu với danh sách Sản phẩm/Công thức/Voucher dưới đây xem cửa hàng có hỗ trợ không. Nếu thiếu nguyên liệu, gợi ý món thay thế gần nhất."
            );
        }
        promptLines.push(context);
        promptLines.push(`Câu hỏi của người dùng: ${userQuestion}`);

        const answer = await askGemini(promptLines.join("\n\n"), image);
        return res.json(withCommonResponseAliases({
            answer,
            model: DEFAULT_MODEL
        }));
    } catch (error) {
        return sendError(res, error.status || 500, error.message || "Không thể gọi trợ lý AI lúc này.");
    }
};
