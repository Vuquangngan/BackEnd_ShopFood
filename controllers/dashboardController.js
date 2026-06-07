const Dashboard = require("../models/dashboardModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

const OVERVIEW_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30000);
const overviewCache = new Map();

exports.getAdminOverview = async (req, res) => {
    try {
        const cacheKey = `admin-overview:${req.user?.id || "anonymous"}`;
        const cached = overviewCache.get(cacheKey);
        if (cached && Date.now() - cached.createdAt < OVERVIEW_CACHE_TTL_MS) {
            return res.json(cached.payload);
        }

        const overview = await Dashboard.getAdminOverview(req.user);
        overviewCache.set(cacheKey, {
            createdAt: Date.now(),
            payload: overview
        });
        return res.json(overview);
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể lấy dữ liệu tổng quan quản trị."
        }));
    }
};
