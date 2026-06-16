require("dotenv").config({ quiet: true });

const nodemailer = require("nodemailer");

function hasSmtpConfig() {
    return Boolean(
        String(process.env.EMAIL_HOST || "").trim() &&
        String(process.env.EMAIL_USER || "").trim() &&
        String(process.env.EMAIL_PASS || "").trim()
    );
}

function hasResendConfig() {
    return Boolean(
        String(process.env.RESEND_API_KEY || "").trim() ||
        (!hasSmtpConfig() && String(process.env.EMAIL_PASS || "").trim())
    );
}

function getResendApiKey() {
    const key = String(process.env.RESEND_API_KEY || "").trim()
        || (!hasSmtpConfig() ? String(process.env.EMAIL_PASS || "").trim() : "");

    if (!key) {
        throw new Error("Chưa cấu hình RESEND_API_KEY cho dịch vụ gửi email.");
    }

    return key;
}

function getFromAddress() {
    const name = String(process.env.EMAIL_FROM_NAME || "FOODIFI").trim() || "FOODIFI";
    const address = String(process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || "onboarding@resend.dev").trim();
    return `${name} <${address}>`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getSmtpTransporter() {
    if (!hasSmtpConfig()) {
        throw new Error("Chưa cấu hình SMTP email (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).");
    }

    const port = Number(process.env.EMAIL_PORT || 587);
    const secure = String(process.env.EMAIL_SECURE || "false").trim().toLowerCase() === "true";

    return nodemailer.createTransport({
        host: String(process.env.EMAIL_HOST || "").trim(),
        port,
        secure,
        auth: {
            user: String(process.env.EMAIL_USER || "").trim(),
            pass: String(process.env.EMAIL_PASS || "").trim()
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
}

async function sendViaSmtp({ to, subject, html, text }) {
    const transporter = getSmtpTransporter();

    try {
        return await transporter.sendMail({
            from: getFromAddress(),
            to: Array.isArray(to) ? to.join(", ") : to,
            subject,
            html,
            text
        });
    } catch (error) {
        if (error?.code === "EAUTH") {
            throw new Error("T�i kho?n email ho?c m?t kh?u ?ng d?ng SMTP kh�ng d�ng.");
        }

        if (["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNRESET"].includes(String(error?.code || ""))) {
            throw new Error("K?t n?i t?i m�y ch? email qu� l�u. Vui l�ng th? l?i sau.");
        }

        throw error;
    } finally {
        transporter.close();
    }
}

async function sendViaResend({ to, subject, html, text }) {
    const apiKey = getResendApiKey();
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: getFromAddress(),
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text
        })
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Resend API error ${res.status}: ${errData.message || res.statusText}`);
    }

    return res.json();
}

async function sendEmail(payload) {
    if (hasSmtpConfig()) {
        return sendViaSmtp(payload);
    }

    if (hasResendConfig()) {
        return sendViaResend(payload);
    }

    throw new Error(
        "Chưa cấu hình dịch vụ gửi email. Hãy thiết lập SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) hoặc RESEND_API_KEY."
    );
}

async function sendForgotPasswordEmail({ to, username, temporaryPassword }) {
    const displayName = username || "bạn";

    await sendEmail({
        to,
        subject: "Mật khẩu tạm thời từ hệ thống FOODIFI",
        text: [
            `Xin chào ${displayName},`,
            "",
            "Hệ thống FOODIFI đã tạo một mật khẩu tạm thời cho tài khoản của bạn.",
            `Mật khẩu tạm thời: ${temporaryPassword}`,
            "",
            "Vui lòng đăng nhập lại và đổi mật khẩu ngay sau khi vào hệ thống.",
            "Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ quản trị viên."
        ].join("\n"),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
                <h2>FOODIFI</h2>
                <p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
                <p>Hệ thống đã tạo một <strong>mật khẩu tạm thời</strong> cho tài khoản của bạn.</p>
                <p style="font-size:18px"><strong>${escapeHtml(temporaryPassword)}</strong></p>
                <p>Vui lòng đăng nhập lại và đổi mật khẩu ngay sau khi vào hệ thống.</p>
                <p>Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ quản trị viên.</p>
            </div>
        `
    });
}

async function sendShiftRegistrationEmail({
    to,
    username,
    branchName,
    shiftName,
    shiftDateLabel,
    startTime,
    endTime
}) {
    const displayName = username || "bạn";

    await sendEmail({
        to,
        subject: `Lịch làm việc đã được xác nhận - ${shiftName}`,
        text: [
            `Xin chào ${displayName},`,
            "",
            "Quản lý đã xác nhận ca làm việc của bạn.",
            `Chi nhánh: ${branchName}`,
            `Ca làm: ${shiftName}`,
            `Ngày làm: ${shiftDateLabel}`,
            `Thời gian: ${startTime} - ${endTime}`,
            "",
            "Vui lòng sắp xếp thời gian để có mặt đúng giờ."
        ].join("\n"),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
                <h2>FOODIFI</h2>
                <p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
                <p>Quản lý đã xác nhận ca làm việc của bạn.</p>
                <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
                    <tr><td><strong>Chi nhánh</strong></td><td>${escapeHtml(branchName)}</td></tr>
                    <tr><td><strong>Ca làm</strong></td><td>${escapeHtml(shiftName)}</td></tr>
                    <tr><td><strong>Ngày làm</strong></td><td>${escapeHtml(shiftDateLabel)}</td></tr>
                    <tr><td><strong>Thời gian</strong></td><td>${escapeHtml(startTime)} - ${escapeHtml(endTime)}</td></tr>
                </table>
                <p style="margin-top:16px">Vui lòng sắp xếp thời gian để có mặt đúng giờ.</p>
            </div>
        `
    });
}

async function sendWeeklyShiftScheduleEmail({
    to,
    username,
    branchName,
    schedules = []
}) {
    const displayName = username || "bạn";
    const scheduleRows = schedules.map((item) => (
        `<tr>
            <td style="border:1px solid #dfe8dd;padding:8px">${escapeHtml(item.shiftDateLabel)}</td>
            <td style="border:1px solid #dfe8dd;padding:8px">${escapeHtml(item.shiftName)}</td>
            <td style="border:1px solid #dfe8dd;padding:8px">${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</td>
        </tr>`
    )).join("");
    const scheduleText = schedules.map((item) => (
        `- ${item.shiftDateLabel}: ${item.shiftName} (${item.startTime} - ${item.endTime})`
    )).join("\n");

    await sendEmail({
        to,
        subject: `Lịch làm việc tuần đã được xác nhận - ${branchName}`,
        text: [
            `Xin chào ${displayName},`,
            "",
            "Quản lý đã xác nhận lịch làm việc trong tuần của bạn.",
            `Chi nhánh: ${branchName}`,
            "",
            scheduleText,
            "",
            "Vui lòng kiểm tra lịch và có mặt đúng giờ."
        ].join("\n"),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
                <h2>FOODIFI</h2>
                <p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
                <p>Quản lý đã xác nhận lịch làm việc trong tuần của bạn tại <strong>${escapeHtml(branchName)}</strong>.</p>
                <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
                    <thead>
                        <tr>
                            <th style="border:1px solid #dfe8dd;padding:8px;text-align:left">Ngày</th>
                            <th style="border:1px solid #dfe8dd;padding:8px;text-align:left">Ca</th>
                            <th style="border:1px solid #dfe8dd;padding:8px;text-align:left">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody>${scheduleRows}</tbody>
                </table>
                <p style="margin-top:16px">Vui lòng kiểm tra lịch và có mặt đúng giờ.</p>
            </div>
        `
    });
}

async function sendCampaignEmail({
    to,
    username,
    subject,
    preheader,
    title,
    summary,
    ctaLabel,
    ctaUrl,
    bannerUrl,
    campaignName
}) {
    const displayName = username || "bạn";
    const safeSubject = String(subject || "").trim();
    const safeTitle = String(title || campaignName || "FOODIFI").trim();
    const safeSummary = String(summary || "").trim();
    const safeCtaLabel = String(ctaLabel || "Xem ngay").trim();
    const safeCtaUrl = String(ctaUrl || "").trim();
    const rawBannerUrl = String(bannerUrl || "").trim();
    const baseUrl = String(process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const safeBannerUrl = rawBannerUrl && rawBannerUrl.startsWith("/") && baseUrl
        ? `${baseUrl}${rawBannerUrl}`
        : rawBannerUrl;

    const buttonHtml = safeCtaUrl
        ? `<p style="margin:24px 0"><a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;background:#0d8748;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${escapeHtml(safeCtaLabel)}</a></p>`
        : "";
    const bannerHtml = safeBannerUrl
        ? `<img src="${escapeHtml(safeBannerUrl)}" alt="${escapeHtml(campaignName || "FOODIFI")}" style="width:100%;max-width:640px;border-radius:18px;display:block;margin:0 0 22px">`
        : "";

    await sendEmail({
        to,
        subject: safeSubject,
        text: [
            `Xin chào ${displayName},`,
            "",
            safeTitle,
            "",
            safeSummary,
            "",
            safeCtaUrl ? `${safeCtaLabel}: ${safeCtaUrl}` : "",
            "",
            "Bạn nhận email này vì đã đăng ký hoặc mua hàng tại FOODIFI."
        ].filter(Boolean).join("\n"),
        html: `
            <div style="margin:0;background:#f4f8ef;padding:28px 12px;font-family:Arial,sans-serif;color:#253728">
                <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 14px 38px rgba(31,63,38,.08)">
                    <div style="font-size:12px;letter-spacing:.14em;font-weight:800;color:#0d8748;text-align:center;margin-bottom:18px">GARDEN FRESH</div>
                    ${bannerHtml}
                    <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
                    <h2 style="font-size:26px;line-height:1.2;color:#0d8748;margin:0 0 14px">${escapeHtml(safeTitle)}</h2>
                    <p style="font-size:15px;line-height:1.7;color:#415242;margin:0">${escapeHtml(safeSummary).replace(/\n/g, "<br>")}</p>
                    ${buttonHtml}
                    ${preheader ? `<p style="font-size:13px;color:#6f7f70;margin-top:18px">${escapeHtml(preheader)}</p>` : ""}
                    <p style="border-top:1px solid #e7eee5;margin-top:24px;padding-top:16px;font-size:12px;color:#7c887d">Bạn nhận email này vì đã đăng ký hoặc mua hàng tại FOODIFI.</p>
                </div>
            </div>
        `
    });
}

module.exports = {
    sendForgotPasswordEmail,
    sendShiftRegistrationEmail,
    sendWeeklyShiftScheduleEmail,
    sendCampaignEmail
};


