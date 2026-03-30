const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
require("dotenv").config({ quiet: true });

function extractBearerOrRawToken(authHeader = "") {
    const header = String(authHeader || "").trim();
    if (!header) return "";
    if (header.startsWith("Bearer ")) {
        return header.slice(7).trim();
    }
    return header;
}

function mapAuthUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
    };
}

async function authenticate(req, res, next) {
    const token = extractBearerOrRawToken(req.headers.authorization || "");

    if (!token) {
        return res.status(401).json(withCommonResponseAliases({
            message: "Bạn cần đăng nhập để sử dụng chức năng này."
        }));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json(withCommonResponseAliases({
                message: "Tài khoản không tồn tại hoặc đã bị xóa."
            }));
        }

        if (user.status !== "active") {
            return res.status(403).json(withCommonResponseAliases({
                message: "Tài khoản của bạn hiện không thể truy cập hệ thống."
            }));
        }

        req.user = mapAuthUser(user);

        return next();
    } catch (error) {
        return res.status(401).json(withCommonResponseAliases({
            message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
        }));
    }
}

async function optionalAuthenticate(req, res, next) {
    const token = extractBearerOrRawToken(req.headers.authorization || "");

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
        const user = await User.findById(decoded.id);

        if (user && user.status === "active") {
            req.user = mapAuthUser(user);
        }
    } catch (error) {
        // Bo qua loi xac thuc o route cong khai.
    }

    return next();
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json(withCommonResponseAliases({
                message: "Bạn cần đăng nhập để sử dụng chức năng này."
            }));
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json(withCommonResponseAliases({
                message: "Bạn không có quyền thực hiện thao tác này."
            }));
        }

        return next();
    };
}

module.exports = {
    authenticate,
    authorize,
    optionalAuthenticate,
    extractBearerOrRawToken
};
