const Dashboard = require("../models/dashboardModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

exports.getAdminOverview = async (req, res) => {
    try {
        const overview = await Dashboard.getAdminOverview(req.user);
        return res.json(overview);
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể lấy dữ liệu tổng quan quản trị."
        }));
    }
};
