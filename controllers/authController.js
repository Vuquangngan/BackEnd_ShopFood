const { randomInt } = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");
const { authenticate } = require("../middlewares/authMiddleware");
const { addVietnameseAliases, getVietnameseLabel } = require("../utils/vietnameseLabels");
const { withCommonResponseAliases } = require("../utils/responseHelpers");
const { sendForgotPasswordEmail } = require("../services/emailService");
const {
    generateAccessToken,
    buildClientMeta,
    createRefreshSession,
    rotateRefreshSession,
    revokeRefreshSession,
    revokeAllUserSessions
} = require("../services/authTokenService");

require("dotenv").config({ quiet: true });

function localizeUser(user) {
    if (!user) return null;

    return addVietnameseAliases(user, {
        username: "ten_nguoi_dung",
        role: "vai_tro_ma",
        role_label: "vai_tro_hien_thi",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi"
    });
}

function buildResponseUser(user) {
    return localizeUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        role_label: getVietnameseLabel("user_role", user.role),
        status: user.status,
        status_label: getVietnameseLabel("user_status", user.status)
    });
}

async function buildAuthPayload(user, req) {
    const accessToken = generateAccessToken(user);
    const refreshSession = await createRefreshSession(user, buildClientMeta(req));

    return withCommonResponseAliases({
        message: "Đăng nhập thành công.",
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshSession.refresh_token,
        refresh_token_expires_at: refreshSession.refresh_token_expires_at,
        user: buildResponseUser(user)
    });
}

function generateTemporaryPassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let password = "";

    for (let index = 0; index < length; index += 1) {
        password += chars[randomInt(chars.length)];
    }

    return password;
}

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập đầy đủ tên người dùng, email và mật khẩu."
            }));
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json(withCommonResponseAliases({
                message: "Email đã tồn tại."
            }));
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const user = await User.createUser(username, email, hashedPassword);

        return res.status(201).json(withCommonResponseAliases({
            message: "Đăng ký thành công.",
            user: buildResponseUser(user)
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Đã xảy ra lỗi máy chủ."
        }));
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập email và mật khẩu."
            }));
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy người dùng."
            }));
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mật khẩu không đúng."
            }));
        }

        return res.json(await buildAuthPayload(user, req));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Đã xảy ra lỗi máy chủ."
        }));
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.body.refresh_token || req.headers["x-refresh-token"];

        if (!refreshToken) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng gửi refresh token để làm mới phiên đăng nhập."
            }));
        }

        const rotated = await rotateRefreshSession(refreshToken, buildClientMeta(req));
        if (!rotated) {
            return res.status(401).json(withCommonResponseAliases({
                message: "Refresh token không hợp lệ hoặc đã hết hạn."
            }));
        }

        const accessToken = generateAccessToken(rotated.user);

        return res.json(withCommonResponseAliases({
            message: "Làm mới phiên đăng nhập thành công.",
            token: accessToken,
            access_token: accessToken,
            refresh_token: rotated.refresh_token,
            refresh_token_expires_at: rotated.refresh_token_expires_at,
            user: buildResponseUser(rotated.user)
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể làm mới phiên đăng nhập vào lúc này."
        }));
    }
};

exports.logout = async (req, res) => {
    try {
        const refreshToken = req.body.refresh_token || req.headers["x-refresh-token"];

        if (!refreshToken) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng gửi refresh token để đăng xuất phiên hiện tại."
            }));
        }

        await revokeRefreshSession(refreshToken);

        return res.json(withCommonResponseAliases({
            message: "Đăng xuất thành công."
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể đăng xuất vào lúc này."
        }));
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập email để lấy lại mật khẩu."
            }));
        }

        const user = await User.findByEmail(email);
        const genericSuccess = withCommonResponseAliases({
            message: "Nếu email tồn tại trong hệ thống, mật khẩu tạm thời đã được gửi tới hộp thư của bạn."
        });

        if (!user) {
            return res.json(genericSuccess);
        }

        const oldPasswordHash = user.password;
        const temporaryPassword = generateTemporaryPassword();
        const newPasswordHash = bcrypt.hashSync(temporaryPassword, 10);

        await User.updatePassword(user.id, newPasswordHash);

        try {
            await sendForgotPasswordEmail({
                to: user.email,
                username: user.username,
                temporaryPassword
            });
            await revokeAllUserSessions(user.id);
        } catch (error) {
            await User.updatePassword(user.id, oldPasswordHash);
            throw error;
        }

        return res.json(genericSuccess);
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể gửi email lấy lại mật khẩu vào lúc này."
        }));
    }
};

exports.changePassword = [authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới."
            }));
        }

        if (String(new_password).length < 6) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mật khẩu mới phải có ít nhất 6 ký tự."
            }));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(withCommonResponseAliases({
                message: "Không tìm thấy người dùng."
            }));
        }

        const isMatch = bcrypt.compareSync(current_password, user.password);
        if (!isMatch) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mật khẩu hiện tại không đúng."
            }));
        }

        const hashedPassword = bcrypt.hashSync(new_password, 10);
        await User.updatePassword(user.id, hashedPassword);
        await revokeAllUserSessions(user.id);

        return res.json(withCommonResponseAliases({
            message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị."
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Đã xảy ra lỗi máy chủ."
        }));
    }
}];
