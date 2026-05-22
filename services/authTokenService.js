const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { RefreshToken, User } = require("../models");

require("dotenv").config({ quiet: true });

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const REFRESH_TOKEN_TTL_DAYS = Math.max(Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30, 1);

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
}

function buildClientMeta(req = {}, extra = {}) {
    return {
        device_name: extra.device_name || req.body?.device_name || null,
        ip_address: extra.ip_address || req.ip || req.headers?.["x-forwarded-for"] || null,
        user_agent: extra.user_agent || req.headers?.["user-agent"] || null
    };
}

async function createRefreshSession(user, meta = {}) {
    const plainToken = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + (REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000));

    await RefreshToken.create({
        user_id: user.id,
        token_hash: hashRefreshToken(plainToken),
        device_name: meta.device_name || null,
        ip_address: meta.ip_address || null,
        user_agent: meta.user_agent || null,
        expires_at: expiresAt
    });

    return {
        refresh_token: plainToken,
        refresh_token_expires_at: expiresAt.toISOString()
    };
}

async function getValidRefreshSession(plainToken) {
    if (!plainToken) return null;

    const tokenHash = hashRefreshToken(plainToken);
    const session = await RefreshToken.findOne({
        where: {
            token_hash: tokenHash,
            revoked_at: null,
            expires_at: { [Op.gt]: new Date() }
        },
        include: [
            {
                model: User,
                as: "user"
            }
        ]
    });

    if (!session || !session.user || session.user.status !== "active") {
        return null;
    }

    return session;
}

async function rotateRefreshSession(plainToken, meta = {}) {
    const session = await getValidRefreshSession(plainToken);
    if (!session) return null;

    await session.update({ revoked_at: new Date() });

    const newSession = await createRefreshSession(session.user, meta);

    return {
        user: session.user,
        ...newSession
    };
}

async function revokeRefreshSession(plainToken) {
    if (!plainToken) return false;

    const tokenHash = hashRefreshToken(plainToken);
    const session = await RefreshToken.findOne({
        where: {
            token_hash: tokenHash,
            revoked_at: null
        }
    });

    if (!session) return false;

    await session.update({ revoked_at: new Date() });
    return true;
}

async function revokeAllUserSessions(userId) {
    await RefreshToken.update(
        { revoked_at: new Date() },
        {
            where: {
                user_id: userId,
                revoked_at: null
            }
        }
    );
}

module.exports = {
    generateAccessToken,
    buildClientMeta,
    createRefreshSession,
    getValidRefreshSession,
    rotateRefreshSession,
    revokeRefreshSession,
    revokeAllUserSessions
};

