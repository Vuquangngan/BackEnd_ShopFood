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
        if ((error.message || "").includes("Unknown database")) {
            console.error(`HÃ£y táº¡o cÆ¡ sá»Ÿ dá»¯ liá»‡u ${process.env.DB_NAME || "shopfood"} trong MySQL trÆ°á»›c, sau Ä‘Ã³ cháº¡y láº¡i lá»‡nh nÃ y.`);
        }
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
