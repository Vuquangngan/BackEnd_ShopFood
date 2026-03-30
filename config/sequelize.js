const { Sequelize } = require("sequelize");
require("dotenv").config({ quiet: true });

const sequelize = new Sequelize(
    process.env.DB_NAME || "shopfood",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        dialect: "mysql",
        logging: false,
        timezone: "+07:00",
        define: {
            freezeTableName: true
        }
    }
);

module.exports = sequelize;
