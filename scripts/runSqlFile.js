const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

async function runSqlFile(fileName) {
    const filePath = path.join(__dirname, "..", "database", fileName);
    const databaseName = process.env.DB_NAME || "foodshop";
    const sql = fs
        .readFileSync(filePath, "utf8")
        .replace(/^\uFEFF/, "")
        .replaceAll("__DB_NAME__", databaseName);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        multipleStatements: true
    });

    try {
        await connection.query(sql);
    } finally {
        await connection.end();
    }
}

module.exports = runSqlFile;
