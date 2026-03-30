const { sequelize } = require("../models");
require("dotenv").config({ quiet: true });

async function main() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ force: true });
        console.log(`Đặt lại schema ORM thành công cho cơ sở dữ liệu ${process.env.DB_NAME || "shopfood"}.`);
    } catch (error) {
        console.error("Không thể đặt lại schema ORM.");
        console.error(error.message || error);
        if ((error.message || "").includes("Unknown database")) {
            console.error(`Hãy tạo cơ sở dữ liệu ${process.env.DB_NAME || "shopfood"} trong MySQL trước, sau đó chạy lại lệnh này.`);
        }
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();