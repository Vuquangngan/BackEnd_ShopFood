const { sequelize } = require("../models");
require("dotenv").config({ quiet: true });

async function main() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: true });
        console.log(`Khá»Ÿi táº¡o schema ORM thÃ nh cÃ´ng cho cÆ¡ sá»Ÿ dá»¯ liá»‡u ${process.env.DB_NAME || "shopfood"}.`);
    } catch (error) {
        console.error("KhÃ´ng thá»ƒ khá»Ÿi táº¡o schema ORM.");
        console.error(error.message || error);
        if ((error.message || "").includes("Unknown database") || (error.message || "").includes("does not exist")) {
            console.error(`Hãy tạo cơ sở dữ liệu ${process.env.DB_NAME || "shopfood"} trước, sau đó chạy lại lệnh này.`);
        }
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
