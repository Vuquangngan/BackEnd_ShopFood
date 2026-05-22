const User = require("../models/userModel");
const { sendCampaignEmail } = require("../services/emailService");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeCampaignPayload(body = {}) {
    return {
        mode: String(body.mode || "send").trim(),
        audience: String(body.audience || "all").trim(),
        campaignName: String(body.campaign_name || body.campaignName || "").trim(),
        subject: String(body.subject || "").trim(),
        preheader: String(body.preheader || "").trim(),
        title: String(body.title || "").trim(),
        summary: String(body.summary || "").trim(),
        ctaLabel: String(body.cta_label || body.ctaLabel || "").trim(),
        ctaUrl: String(body.cta_url || body.ctaUrl || "").trim(),
        bannerUrl: String(body.banner_url || body.bannerUrl || "").trim(),
        testEmail: String(body.test_email || body.testEmail || "").trim()
    };
}

function filterAudience(customers, audience) {
    const activeCustomers = customers.filter((customer) => {
        return isValidEmail(customer.email) && (!customer.status || customer.status === "active");
    });

    if (audience === "loyal") {
        const loyalTiers = new Set(["vang", "bach_kim", "kim_cuong", "vip", "gold", "platinum", "diamond"]);
        return activeCustomers.filter((customer) => {
            return loyalTiers.has(String(customer.membership_tier || "")) || Number(customer.completed_orders_count || 0) >= 2;
        });
    }

    if (audience === "inactive") {
        return activeCustomers.filter((customer) => {
            return Number(customer.completed_orders_count || 0) === 0 || Number(customer.total_spent || 0) === 0;
        });
    }

    return activeCustomers;
}

async function send(req, res) {
    const campaign = normalizeCampaignPayload(req.body);

    if (!campaign.subject || !campaign.title || !campaign.summary) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui lòng nhập tiêu đề email và nội dung chiến dịch."
        }));
    }

    let recipients = [];

    if (campaign.mode === "test") {
        const testEmail = campaign.testEmail || req.user?.email || "";
        if (!isValidEmail(testEmail)) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Email gửi thử không hợp lệ."
            }));
        }
        recipients = [{
            id: req.user?.id || "test",
            username: req.user?.username || "Quản trị viên",
            email: testEmail
        }];
    } else {
        const customers = await User.getCustomers({});
        recipients = filterAudience(customers, campaign.audience);

        if (!recipients.length) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Không có khách hàng phù hợp để gửi chiến dịch email."
            }));
        }
    }

    const results = await Promise.allSettled(recipients.map((recipient) => sendCampaignEmail({
        to: recipient.email,
        username: recipient.username,
        subject: campaign.subject,
        preheader: campaign.preheader,
        title: campaign.title,
        summary: campaign.summary,
        ctaLabel: campaign.ctaLabel,
        ctaUrl: campaign.ctaUrl,
        bannerUrl: campaign.bannerUrl,
        campaignName: campaign.campaignName
    })));

    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;
    const firstError = results.find((result) => result.status === "rejected")?.reason;

    if (sent === 0 && failed > 0) {
        return res.status(502).json(withCommonResponseAliases({
            message: firstError ? `Không gửi được email. Lỗi đầu tiên: ${firstError.message || firstError}` : "Không gửi được email.",
            sent,
            failed,
            total: recipients.length
        }));
    }

    return res.json(withCommonResponseAliases({
        message: campaign.mode === "test" ? "Đã gửi email thử." : "Đã xử lý gửi chiến dịch email.",
        sent,
        failed,
        total: recipients.length,
        first_error: firstError ? String(firstError.message || firstError).slice(0, 240) : ""
    }));
}

module.exports = {
    send
};
