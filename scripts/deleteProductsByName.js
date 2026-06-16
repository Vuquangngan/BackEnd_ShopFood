const { sequelize, CartItem, Product } = require("../models");

const PRODUCT_NAMES = [
    "Dau an huong duong",
    "Nuoc mam truyen thong",
    "Gao ST25",
    // Thêm tên sản phẩm khác vào đây nếu cần
];

async function deleteProductsByName() {
    try {
        await sequelize.authenticate();
        console.log("Đã kết nối database.");

        for (const name of PRODUCT_NAMES) {
            const product = await Product.findOne({
                where: sequelize.where(
                    sequelize.fn("LOWER", sequelize.col("name")),
                    sequelize.fn("LOWER", name)
                )
            });

            if (!product) {
                console.log(`Không tìm thấy: "${name}"`);
                continue;
            }

            // Xóa cart items trước
            const cartDeleted = await CartItem.destroy({ where: { product_id: product.id } });
            if (cartDeleted > 0) {
                console.log(`  Đã xóa ${cartDeleted} cart item của "${name}"`);
            }

            await product.destroy();
            console.log(`✓ Đã xóa sản phẩm: "${name}" (id=${product.id})`);
        }

        console.log("\nHoàn tất.");
    } catch (err) {
        console.error("Lỗi:", err.message);
    } finally {
        await sequelize.close();
    }
}

deleteProductsByName();
