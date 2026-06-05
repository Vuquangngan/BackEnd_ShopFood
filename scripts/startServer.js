process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.DB_SYNC_ON_START = process.env.DB_SYNC_ON_START || "false";

require("../server");
