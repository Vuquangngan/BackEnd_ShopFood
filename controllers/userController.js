const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const { sendShiftRegistrationEmail } = require("../services/emailService");
const { addVietnameseAliases, addVietnameseLabels, getVietnameseLabel } = require("../utils/vietnameseLabels");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function isAdminRequest(req) {
    return req.user?.role === "admin";
}

function localizeAddress(address) {
    if (!address) return null;

    return addVietnameseAliases(address, {
        full_name: "ho_ten_nguoi_nhan",
        phone: "so_dien_thoai",
        address_line: "dia_chi_chi_tiet",
        ward: "phuong_xa",
        district: "quan_huyen",
        city: "tinh_thanh",
        is_default: "dia_chi_mac_dinh",
        created_at: "ngay_tao",
        updated_at: "ngay_cap_nhat"
    });
}

function localizeUser(user) {
    if (!user) return null;

    const addresses = (user.addresses || []).map(localizeAddress);
    const localized = addVietnameseLabels({
        ...user,
        role_label: getVietnameseLabel("user_role", user.role),
        status_label: getVietnameseLabel("user_status", user.status)
    }, {});

    return {
        ...addVietnameseAliases(localized, {
            username: "ten_nguoi_dung",
            code: "ma_nhan_vien",
            phone: "so_dien_thoai",
            avatar_url: "anh_dai_dien",
            role: "vai_tro_ma",
            role_label: "vai_tro_hien_thi",
            status: "trang_thai_ma",
            status_label: "trang_thai_hien_thi",
            addresses: "danh_sach_dia_chi",
            created_at: "ngay_tao",
            updated_at: "ngay_cap_nhat"
        }),
        addresses,
        danh_sach_dia_chi: addresses
    };
}

function localizeCustomer(user) {
    if (!user) return null;

    const localizedUser = localizeUser(user);
    return addVietnameseAliases({
        ...localizedUser,
        loyalty_points: user.loyalty_points || 0,
        points: user.loyalty_points || 0,
        diem_tich_luy: user.loyalty_points || 0,
        membership_tier: user.membership_tier || "dong",
        membership_tier_label: user.membership_tier_label || "Đồng",
        hang_thanh_vien_hien_thi: user.membership_tier_label || "Đồng",
        total_spent: user.total_spent || 0,
        completed_orders_count: user.completed_orders_count || 0,
        so_don_hoan_thanh: user.completed_orders_count || 0,
        next_membership_tier: user.next_membership_tier || null,
        next_membership_tier_label: user.next_membership_tier_label || null,
        points_to_next_tier: user.points_to_next_tier || 0
    }, {
        loyalty_points: "diem_tich_luy",
        membership_tier: "hang_thanh_vien_ma",
        membership_tier_label: "hang_thanh_vien_hien_thi",
        total_spent: "tong_chi_tieu",
        completed_orders_count: "so_don_hoan_thanh",
        next_membership_tier: "hang_tiep_theo_ma",
        next_membership_tier_label: "hang_tiep_theo_hien_thi",
        points_to_next_tier: "diem_con_thieu"
    });
}

exports.getMe = async (req, res) => {
    const user = await User.getProfile(req.user.id);
    return res.json(user?.role === "customer" ? localizeCustomer(user) : localizeUser(user));
};

exports.updateMe = async (req, res) => {
    const user = await User.updateProfile(req.user.id, req.body);
    return res.json(localizeUser(user));
};

exports.getAll = async (req, res) => {
    const users = await User.getAll(req.query);
    return res.json(users.map(localizeUser));
};

exports.getCustomers = async (req, res) => {
    const customers = await User.getCustomers(req.query);
    return res.json(customers.map(localizeCustomer));
};

exports.getById = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma nguoi dung khong hop le."
        }));
    }

    const user = await User.getProfile(id);

    if (!user) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Khong tim thay nguoi dung."
        }));
    }

    return res.json(localizeUser(user));
};

exports.create = async (req, res) => {
    const username = String(req.body.username || "").trim();
    const code = String(req.body.code || "").trim() || null;
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = ["admin", "staff", "customer"].includes(req.body.role) ? req.body.role : "customer";
    const status = ["active", "inactive", "blocked"].includes(req.body.status) ? req.body.status : "active";

    if (!isAdminRequest(req) && role === "admin") {
        return res.status(403).json(withCommonResponseAliases({
            message: "Chi quan tri vien moi co the tao tai khoan admin."
        }));
    }

    if (!username || !email || password.length < 6) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui long nhap ten nguoi dung, email hop le va mat khau toi thieu 6 ky tu."
        }));
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        return res.status(409).json(withCommonResponseAliases({
            message: "Email da ton tai."
        }));
    }

    if (code) {
        const existingCode = await User.findByCode(code);
        if (existingCode) {
            return res.status(409).json(withCommonResponseAliases({
                message: "Ma nhan vien da ton tai."
            }));
        }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const createdUser = await User.createUser(username, email, hashedPassword, {
        code,
        phone: req.body.phone ? String(req.body.phone).trim() : null,
        avatar_url: req.body.avatar_url ? String(req.body.avatar_url).trim() : null,
        role,
        status,
        must_change_password: Boolean(req.body.must_change_password)
    });

    const user = await User.getProfile(createdUser.id);
    return res.status(201).json(localizeUser(user));
};

exports.update = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma nguoi dung khong hop le."
        }));
    }

    const existingUser = await User.findById(id);
    if (!existingUser) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Khong tim thay nguoi dung."
        }));
    }

    if (!isAdminRequest(req) && existingUser.role === "admin") {
        return res.status(403).json(withCommonResponseAliases({
            message: "Chi quan tri vien moi co the cap nhat tai khoan admin."
        }));
    }

    const nextEmail = req.body.email !== undefined
        ? String(req.body.email || "").trim().toLowerCase()
        : undefined;
    const nextCode = req.body.code !== undefined
        ? String(req.body.code || "").trim() || null
        : undefined;

    if (nextEmail) {
        const duplicatedUser = await User.findByEmail(nextEmail);
        if (duplicatedUser && Number(duplicatedUser.id) !== id) {
            return res.status(409).json(withCommonResponseAliases({
                message: "Email da ton tai."
            }));
        }
    }

    if (nextCode) {
        const duplicatedCode = await User.findByCode(nextCode);
        if (duplicatedCode && Number(duplicatedCode.id) !== id) {
            return res.status(409).json(withCommonResponseAliases({
                message: "Ma nhan vien da ton tai."
            }));
        }
    }

    if (Number(req.user.id) === id && req.body.status && req.body.status !== "active") {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ban khong the tu khoa tai khoan dang dang nhap."
        }));
    }

    const payload = {
        username: req.body.username !== undefined ? String(req.body.username || "").trim() : undefined,
        code: nextCode,
        email: nextEmail,
        phone: req.body.phone !== undefined ? String(req.body.phone || "").trim() : undefined,
        avatar_url: req.body.avatar_url !== undefined ? String(req.body.avatar_url || "").trim() : undefined,
        role: ["admin", "staff", "customer"].includes(req.body.role) ? req.body.role : undefined,
        status: ["active", "inactive", "blocked"].includes(req.body.status) ? req.body.status : undefined,
        must_change_password: req.body.must_change_password !== undefined ? Boolean(req.body.must_change_password) : undefined
    };

    if (!isAdminRequest(req) && payload.role === "admin") {
        return res.status(403).json(withCommonResponseAliases({
            message: "Chi quan tri vien moi co the gan vai tro admin."
        }));
    }

    if (req.body.password !== undefined && String(req.body.password || "")) {
        const currentPassword = String(req.body.current_password || "");
        const nextPassword = String(req.body.password || "");

        if (!currentPassword) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Vui lòng nhập mật khẩu cũ trước khi đổi mật khẩu."
            }));
        }

        const isCurrentPasswordMatched = bcrypt.compareSync(currentPassword, existingUser.password);
        if (!isCurrentPasswordMatched) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mật khẩu cũ không đúng."
            }));
        }

        if (nextPassword.length < 6) {
            return res.status(400).json(withCommonResponseAliases({
                message: "Mat khau moi phai co it nhat 6 ky tu."
            }));
        }
        payload.password = bcrypt.hashSync(nextPassword, 10);
        payload.must_change_password = false;
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const user = await User.updateAdminUser(id, payload);
    return res.json(localizeUser(user));
};

exports.remove = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma nguoi dung khong hop le."
        }));
    }

    if (Number(req.user.id) === id) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ban khong the xoa tai khoan dang dang nhap."
        }));
    }

    const existingUser = await User.findById(id);
    if (!existingUser) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Khong tim thay nguoi dung."
        }));
    }

    if (!isAdminRequest(req) && existingUser.role === "admin") {
        return res.status(403).json(withCommonResponseAliases({
            message: "Chi quan tri vien moi co the xoa tai khoan admin."
        }));
    }

    await User.removeUser(id);

    return res.json(withCommonResponseAliases({
        message: "Xoa nguoi dung thanh cong."
    }));
};

exports.getMyAddresses = async (req, res) => {
    const addresses = await User.getAddresses(req.user.id);
    return res.json(addresses.map(localizeAddress));
};

exports.createMyAddress = async (req, res) => {
    const { full_name, phone, address_line, city } = req.body;

    if (!full_name || !phone || !address_line || !city) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui long nhap day du ho ten nguoi nhan, so dien thoai, dia chi chi tiet va tinh thanh pho."
        }));
    }

    const address = await User.createAddress(req.user.id, req.body);
    return res.status(201).json(localizeAddress(address));
};

exports.updateMyAddress = async (req, res) => {
    const addressId = parseId(req.params.addressId);

    if (!addressId) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma dia chi khong hop le."
        }));
    }

    const address = await User.updateAddress(req.user.id, addressId, req.body);

    if (!address) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Khong tim thay dia chi can cap nhat."
        }));
    }

    return res.json(localizeAddress(address));
};

exports.deleteMyAddress = async (req, res) => {
    const addressId = parseId(req.params.addressId);

    if (!addressId) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Ma dia chi khong hop le."
        }));
    }

    const deleted = await User.removeAddress(req.user.id, addressId);

    if (!deleted) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Khong tim thay dia chi can xoa."
        }));
    }

    return res.json(withCommonResponseAliases({
        message: "Xoa dia chi thanh cong."
    }));
};

