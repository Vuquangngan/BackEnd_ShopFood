process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.DB_SYNC_ON_START = process.env.DB_SYNC_ON_START || "true";

require("../server");
