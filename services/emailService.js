const nodemailer = require("nodemailer");

require("dotenv").config({ quiet: true });

let transporter;

function isSecureConnection() {
    const rawValue = String(process.env.EMAIL_SECURE || "false").toLowerCase();
    return rawValue === "true" || rawValue === "1" || rawValue === "yes";
}

function getTransporter() {
    if (transporter) return transporter;

    if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Chức năng gửi email chưa được cấu hình. Vui lòng bổ sung EMAIL_HOST, EMAIL_PORT, EMAIL_USER và EMAIL_PASS trong file .env.");
    }

    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: isSecureConnection(),
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    return transporter;
}

function getFromAddress() {
    return {
        name: process.env.EMAIL_FROM_NAME || "ShopFood",
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
    };
}

async function sendForgotPasswordEmail({ to, username, temporaryPassword }) {
    const mailer = getTransporter();
    const displayName = username || "bạn";

    await mailer.sendMail({
        from: getFromAddress(),
        to,
        subject: "Mật khẩu tạm thời từ hệ thống ShopFood",
        text: [
            `Xin chào ${displayName},`,
            "",
            "Hệ thống ShopFood đã tạo một mật khẩu tạm thời cho tài khoản của bạn.",
            `Mật khẩu tạm thời: ${temporaryPassword}`,
            "",
            "Vui lòng đăng nhập lại và đổi mật khẩu ngay sau khi vào hệ thống.",
            "Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ quản trị viên."
        ].join("\n"),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
                <h2>ShopFood</h2>
                <p>Xin chào <strong>${displayName}</strong>,</p>
                <p>Hệ thống đã tạo một <strong>mật khẩu tạm thời</strong> cho tài khoản của bạn.</p>
                <p style="font-size:18px"><strong>${temporaryPassword}</strong></p>
                <p>Vui lòng đăng nhập lại và đổi mật khẩu ngay sau khi vào hệ thống.</p>
                <p>Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ quản trị viên.</p>
            </div>
        `
    });
}

module.exports = {
    sendForgotPasswordEmail
};
