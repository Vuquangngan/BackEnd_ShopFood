const { randomInt } = require("crypto");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const { OAuth2Client } = require("google-auth-library");

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

const googleClient = new OAuth2Client();

function localizeUser(user) {
    if (!user) return null;

    return addVietnameseAliases(user, {
        username: "ten_nguoi_dung",
        role: "vai_tro_ma",
        role_label: "vai_tro_hien_thi",
        status: "trang_thai_ma",
        status_label: "trang_thai_hien_thi",
        must_change_password: "bat_buoc_doi_mat_khau"
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
        status_label: getVietnameseLabel("user_status", user.status),
        must_change_password: Boolean(user.must_change_password),
        loyalty_points: user.loyalty_points || 0,
        diem_tich_luy: user.loyalty_points || 0,
        points: user.loyalty_points || 0,
        membership_tier: user.membership_tier || "dong",
        membership_tier_label: user.membership_tier_label || "Đồng",
        hang_thanh_vien_hien_thi: user.membership_tier_label || "Đồng",
        completed_orders_count: user.completed_orders_count || 0,
        so_don_hoan_thanh: user.completed_orders_count || 0
    });
}

async function buildAuthPayload(user, req) {
    const accessToken = generateAccessToken(user);
    const refreshSession = await createRefreshSession(user, buildClientMeta(req));
    const responseUser = await User.getProfile(user.id) || user;

    return withCommonResponseAliases({
        message: "Đăng nhập thành công.",
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshSession.refresh_token,
        refresh_token_expires_at: refreshSession.refresh_token_expires_at,
        user: buildResponseUser(responseUser)
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

function buildGoogleUsername(payload) {
    if (payload.name && String(payload.name).trim()) {
        return String(payload.name).trim().slice(0, 100);
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const emailPrefix = email.split("@")[0];
    return (emailPrefix || `google-user-${Date.now()}`).slice(0, 100);
}

async function verifyGoogleIdToken(idToken) {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) {
        throw new Error("Dang nhap Google chua duoc cau hinh. Vui long bo sung GOOGLE_WEB_CLIENT_ID trong file .env.");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience
    });

    return ticket.getPayload();
}

exports.register = async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

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
            message: error.message || "Đã xảy ra lỗi."
        }));
    }
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

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
            message: error.message || "Đã xảy ra lỗi."
        }));
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const idToken = req.body.id_token || req.body.idToken;
        if (!idToken) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui long gui Google ID token."
            }));
        }

        const payload = await verifyGoogleIdToken(idToken);
        if (!payload?.email) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Khong lay duoc email tu tai khoan Google."
            }));
        }

        if (payload.email_verified === false) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Email Google chua duoc xac minh."
            }));
        }

        let user = await User.findByEmail(payload.email);
        if (!user) {
            const generatedPassword = bcrypt.hashSync(randomBytes(32).toString("hex"), 10);
            user = await User.createUser(
                buildGoogleUsername(payload),
                payload.email,
                generatedPassword,
                {
                    must_change_password: false
                }
            );
        }

        return res.json(await buildAuthPayload(user, req));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Khong the dang nhap bang Google vao luc nay."
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
            message: "Đăng nhập thành công.",
            token: accessToken,
            access_token: accessToken,
            refresh_token: rotated.refresh_token,
            refresh_token_expires_at: rotated.refresh_token_expires_at,
            user: buildResponseUser(rotated.user)
        }));
    } catch (error) {
        return res.status(500).json(withCommonResponseAliases({
            message: error.message || "Không thể đăng nhập vào lúc này."
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
            message: "Mật khẩu tạm thời đã được gửi tới email của bạn."
        });

        if (!user) {
            return res.json(genericSuccess);
        }

        const oldPasswordHash = user.password;
        const temporaryPassword = generateTemporaryPassword();
        const newPasswordHash = bcrypt.hashSync(temporaryPassword, 10);

        await User.updatePassword(user.id, newPasswordHash, {
            must_change_password: true
        });

        try {
            await sendForgotPasswordEmail({
                to: user.email,
                username: user.username,
                temporaryPassword
            });
            await revokeAllUserSessions(user.id);
        } catch (error) {
            await User.updatePassword(user.id, oldPasswordHash, {
                must_change_password: false
            });
            throw error;
        }

        return res.json(genericSuccess);
    } catch (error) {
        console.error("[forgotPassword] SMTP error:", error.message, error.code, error.command);
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
        await User.updatePassword(user.id, hashedPassword, {
            must_change_password: false
        });
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
