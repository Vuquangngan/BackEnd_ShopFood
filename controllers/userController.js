const User = require("../models/userModel");
const { addVietnameseAliases, addVietnameseLabels, getVietnameseLabel } = require("../utils/vietnameseLabels");
const { withCommonResponseAliases } = require("../utils/responseHelpers");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
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

exports.getMe = async (req, res) => {
    const user = await User.getProfile(req.user.id);
    return res.json(localizeUser(user));
};

exports.updateMe = async (req, res) => {
    const user = await User.updateProfile(req.user.id, req.body);
    return res.json(localizeUser(user));
};

exports.getAll = async (req, res) => {
    const users = await User.getAll(req.query);
    return res.json(users.map(localizeUser));
};

exports.getById = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Mã người dùng không hợp lệ."
        }));
    }

    const user = await User.getProfile(id);

    if (!user) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Không tìm thấy người dùng."
        }));
    }

    return res.json(localizeUser(user));
};

exports.getMyAddresses = async (req, res) => {
    const addresses = await User.getAddresses(req.user.id);
    return res.json(addresses.map(localizeAddress));
};

exports.createMyAddress = async (req, res) => {
    const { full_name, phone, address_line, city } = req.body;

    if (!full_name || !phone || !address_line || !city) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Vui lòng nhập đầy đủ họ tên người nhận, số điện thoại, địa chỉ chi tiết và tỉnh/thành phố."
        }));
    }

    const address = await User.createAddress(req.user.id, req.body);
    return res.status(201).json(localizeAddress(address));
};

exports.updateMyAddress = async (req, res) => {
    const addressId = parseId(req.params.addressId);

    if (!addressId) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Mã địa chỉ không hợp lệ."
        }));
    }

    const address = await User.updateAddress(req.user.id, addressId, req.body);

    if (!address) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Không tìm thấy địa chỉ cần cập nhật."
        }));
    }

    return res.json(localizeAddress(address));
};

exports.deleteMyAddress = async (req, res) => {
    const addressId = parseId(req.params.addressId);

    if (!addressId) {
        return res.status(400).json(withCommonResponseAliases({
            message: "Mã địa chỉ không hợp lệ."
        }));
    }

    const deleted = await User.removeAddress(req.user.id, addressId);

    if (!deleted) {
        return res.status(404).json(withCommonResponseAliases({
            message: "Không tìm thấy địa chỉ cần xóa."
        }));
    }

    return res.json(withCommonResponseAliases({
        message: "Xóa địa chỉ thành công."
    }));
};