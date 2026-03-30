const http = require("http");
const express = require("express");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

require("dotenv").config({ quiet: true });

const { sequelize } = require("./models");
const swaggerSpec = require("./docs/swagger");
const { withCommonResponseAliases } = require("./utils/responseHelpers");
const { initializeChatSocket } = require("./sockets/chatSocket");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const cartRoutes = require("./routes/cartRoutes");
const couponRoutes = require("./routes/couponRoutes");
const orderRoutes = require("./routes/orderRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "ShopFood API Docs"
}));
app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
    res.send("API đang hoạt động. Truy cập /api-docs để xem tài liệu Swagger.");
});

app.use((req, res) => {
    res.status(404).json(withCommonResponseAliases({
        message: "Không tìm thấy đường dẫn yêu cầu."
    }));
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Dữ liệu JSON gửi lên không hợp lệ."
        }));
    }

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json(withCommonResponseAliases({
                message: `Kích thước ảnh vượt quá giới hạn ${process.env.UPLOAD_MAX_FILE_SIZE_MB || 5} MB.`
            }));
        }

        return res.status(400).json(withCommonResponseAliases({
            message: error.message || "Tệp tải lên không hợp lệ."
        }));
    }

    if (error && (error.status === 400 || error.statusCode === 400)) {
        return res.status(400).json(withCommonResponseAliases({
            message: error.message || "Yêu cầu không hợp lệ."
        }));
    }

    console.error("Lỗi ứng dụng:", error.message || error);

    return res.status(error.status || error.statusCode || 500).json(withCommonResponseAliases({
        message: "Đã xảy ra lỗi máy chủ."
    }));
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await sequelize.authenticate();
        initializeChatSocket(httpServer);
        console.log("Kết nối Sequelize thành công.");

        httpServer.listen(PORT, () => {
            console.log(`Máy chủ đang chạy ở cổng ${PORT}.`);
            console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
            console.log(`Socket chat realtime đang sẵn sàng tại ws://localhost:${PORT}`);
        });
    } catch (error) {
        console.log("Kết nối cơ sở dữ liệu thất bại.");
        console.log(error.message || error);
        process.exit(1);
    }
}

startServer();


