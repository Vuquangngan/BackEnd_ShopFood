require("dotenv").config({ quiet: true });

function getResendApiKey() {
    const key = process.env.EMAIL_PASS || "";
    if (!key) throw new Error("Chưa cấu hình Resend API key (EMAIL_PASS).");
    return key;
}

function getFromAddress() {
    const name = process.env.EMAIL_FROM_NAME || "FOODIFI";
    const address = process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
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

async function sendViaResend({ to, subject, html, text }) {
    const apiKey = getResendApiKey();
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
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

async function sendForgotPasswordEmail({ to, username, temporaryPassword }) {
    const displayName = username || "bạn";

    await sendViaResend({
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
                <p>Xin chào <strong>${displayName}</strong>,</p>
                <p>Hệ thống đã tạo một <strong>mật khẩu tạm thời</strong> cho tài khoản của bạn.</p>
                <p style="font-size:18px"><strong>${temporaryPassword}</strong></p>
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

    await sendViaResend({
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
                <p>Xin chào <strong>${displayName}</strong>,</p>
                <p>Quản lý đã xác nhận ca làm việc của bạn.</p>
                <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
                    <tr><td><strong>Chi nhánh</strong></td><td>${branchName}</td></tr>
                    <tr><td><strong>Ca làm</strong></td><td>${shiftName}</td></tr>
                    <tr><td><strong>Ngày làm</strong></td><td>${shiftDateLabel}</td></tr>
                    <tr><td><strong>Thời gian</strong></td><td>${startTime} - ${endTime}</td></tr>
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
            <td style="border:1px solid #dfe8dd;padding:8px">${item.shiftDateLabel}</td>
            <td style="border:1px solid #dfe8dd;padding:8px">${item.shiftName}</td>
            <td style="border:1px solid #dfe8dd;padding:8px">${item.startTime} - ${item.endTime}</td>
        </tr>`
    )).join("");
    const scheduleText = schedules.map((item) => (
        `- ${item.shiftDateLabel}: ${item.shiftName} (${item.startTime} - ${item.endTime})`
    )).join("\n");

    await sendViaResend({
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
                <p>Xin chào <strong>${displayName}</strong>,</p>
                <p>Quản lý đã xác nhận lịch làm việc trong tuần của bạn tại <strong>${branchName}</strong>.</p>
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
    const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
    const safeBannerUrl = rawBannerUrl && rawBannerUrl.startsWith("/") && BASE_URL
        ? `${BASE_URL}${rawBannerUrl}`
        : rawBannerUrl;
    const buttonHtml = safeCtaUrl
        ? `<p style="margin:24px 0"><a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;background:#0d8748;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${escapeHtml(safeCtaLabel)}</a></p>`
        : "";
    const bannerHtml = safeBannerUrl
        ? `<img src="${escapeHtml(safeBannerUrl)}" alt="${escapeHtml(campaignName || "FOODIFI")}" style="width:100%;max-width:640px;border-radius:18px;display:block;margin:0 0 22px">`
        : "";

    await sendViaResend({
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
