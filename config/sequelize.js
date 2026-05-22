const { Sequelize } = require("sequelize");
require("dotenv").config({ quiet: true });

const dialect = process.env.DB_DIALECT || (process.env.DATABASE_URL ? "postgres" : "mysql");
const baseOptions = {
    dialect,
    logging: false,
    timezone: "+07:00",
    define: {
        freezeTableName: true
    }
};

if (dialect === "postgres" && process.env.DB_SSL !== "false") {
    baseOptions.dialectOptions = {
        ssl: {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true"
        }
    };
}

const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, baseOptions)
    : new Sequelize(
        process.env.DB_NAME || "shopfood",
        process.env.DB_USER || "root",
        process.env.DB_PASSWORD || "",
        {
            ...baseOptions,
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT || (dialect === "postgres" ? 5432 : 3306))
        }
    );

module.exports = sequelize;
