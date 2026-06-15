const { Op } = require("sequelize");
const { sequelize, Order, User, UserAddress } = require("./index");

const USER_UPDATE_FIELDS = ["username", "phone", "avatar_url"];
const ADMIN_USER_UPDATE_FIELDS = ["username", "code", "email", "phone", "avatar_url", "role", "status", "must_change_password"];
const ADDRESS_FIELDS = ["full_name", "phone", "address_line", "ward", "district", "city", "is_default"];
const CUSTOMER_POINT_STEP_AMOUNT = 1000;
const CUSTOMER_TIERS = [
    { key: "dong", label: "Đồng", minPoints: 0 },
    { key: "bac", label: "Bạc", minPoints: 500 },
    { key: "vang", label: "Vàng", minPoints: 2500 },
    { key: "bach_kim", label: "Bạch kim", minPoints: 5000 },
    { key: "kim_cuong", label: "Kim cương", minPoints: 14000 },
    { key: "vip", label: "VIP", minPoints: 20000 }
];

function toPlainUser(userInstance) {
    if (!userInstance) return null;
    return userInstance.get ? userInstance.get({ plain: true }) : userInstance;
}

function toPlainAddress(addressInstance) {
    if (!addressInstance) return null;
    return addressInstance.get ? addressInstance.get({ plain: true }) : addressInstance;
}

function getTierFromPoints(pointsValue) {
    const points = Number(pointsValue || 0);
    return [...CUSTOMER_TIERS]
        .sort((left, right) => left.minPoints - right.minPoints)
        .reduce((currentTier, tier) => (points >= tier.minPoints ? tier : currentTier), CUSTOMER_TIERS[0]);
}

function calculateOrderLoyaltyPoints(orderValue) {
    const value = Number(orderValue || 0);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value / CUSTOMER_POINT_STEP_AMOUNT);
}

function isLoyaltyEligibleOrder(order) {
    if (!order || order.status === "cancelled" || order.return_status) return false;
    const shippingStatus = String(order.shipping_status || "").trim().toLowerCase();
    return order.status === "completed" ||
        shippingStatus === "delivered" ||
        Boolean(order.customer_received_at) ||
        Boolean(order.completed_at) ||
        Boolean(order.delivered_at);
}

function decorateCustomer(user, orders) {
    const completedOrders = orders.filter(isLoyaltyEligibleOrder);
    const completedOrdersCount = completedOrders.length;
    const totalSpent = completedOrders.reduce((sum, order) => {
        return sum + Number(order.subtotal || order.total_amount || 0);
    }, 0);
    const loyaltyPoints = completedOrders.reduce((sum, order) => {
        return sum + calculateOrderLoyaltyPoints(order.subtotal || order.total_amount);
    }, 0);
    const currentTier = getTierFromPoints(loyaltyPoints);
    const nextTier = CUSTOMER_TIERS.find((tier) => tier.minPoints > currentTier.minPoints) || null;

    return {
        ...user,
        completed_orders_count: completedOrdersCount,
        total_spent: totalSpent,
        loyalty_points: loyaltyPoints,
        membership_tier: currentTier.key,
        membership_tier_label: currentTier.label,
        next_membership_tier: nextTier?.key || null,
        next_membership_tier_label: nextTier?.label || null,
        points_to_next_tier: nextTier ? Math.max(0, nextTier.minPoints - loyaltyPoints) : 0
    };
}

const UserModel = {
    createUser(username, email, password, extra = {}) {
        return User.create({ username, email, password, ...extra });
    },

    findByEmail(email) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        return User.findOne({
            where: sequelize.where(
                sequelize.fn("LOWER", sequelize.col("email")),
                normalizedEmail
            )
        });
    },

    findByCode(code) {
        const normalizedCode = String(code || "").trim();
        if (!normalizedCode) return null;
        return User.findOne({
            where: { code: normalizedCode }
        });
    },

    findById(id) {
        return User.findByPk(id);
    },

    async updatePassword(id, password, extra = {}) {
        const user = await User.findByPk(id);
        if (!user) return null;
        await user.update({ password, ...extra });
        return user;
    },

    async getAll(filters = {}) {
        const where = {};

        if (filters.role) {
            where.role = filters.role;
        } else if (filters.scope === "staff") {
            where.role = { [Op.in]: ["admin", "staff"] };
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.keyword) {
            where[Op.or] = [
                { username: { [Op.like]: `%${filters.keyword}%` } },
                { code: { [Op.like]: `%${filters.keyword}%` } },
                { email: { [Op.like]: `%${filters.keyword}%` } },
                { phone: { [Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const users = await User.findAll({
            where,
            attributes: { exclude: ["password"] },
            order: [["created_at", "DESC"]]
        });

        return users.map(toPlainUser);
    },

    async getCustomers(filters = {}) {
        const where = {
            role: "customer"
        };

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.keyword) {
            where[Op.or] = [
                { username: { [Op.like]: `%${filters.keyword}%` } },
                { code: { [Op.like]: `%${filters.keyword}%` } },
                { email: { [Op.like]: `%${filters.keyword}%` } },
                { phone: { [Op.like]: `%${filters.keyword}%` } }
            ];
        }

        const customerUsers = await User.findAll({
            where,
            attributes: { exclude: ["password"] },
            order: [["created_at", "DESC"]]
        });

        const customers = customerUsers.map(toPlainUser);
        const userIds = customers.map((user) => Number(user.id)).filter(Boolean);
        if (!userIds.length) return [];

        const orders = await Order.findAll({
            where: {
                user_id: { [Op.in]: userIds }
            },
            attributes: [
                "id",
                "user_id",
                "status",
                "return_status",
                "shipping_status",
                "subtotal",
                "total_amount",
                "delivered_at",
                "completed_at",
                "customer_received_at"
            ]
        });

        const ordersByUserId = new Map();
        orders.forEach((orderInstance) => {
            const order = orderInstance.get ? orderInstance.get({ plain: true }) : orderInstance;
            const key = Number(order.user_id);
            const bucket = ordersByUserId.get(key) || [];
            bucket.push(order);
            ordersByUserId.set(key, bucket);
        });

        const decoratedCustomers = customers.map((customer) => decorateCustomer(customer, ordersByUserId.get(Number(customer.id)) || []));

        if (filters.tier) {
            return decoratedCustomers.filter((customer) => customer.membership_tier === filters.tier);
        }

        return decoratedCustomers;
    },

    async getProfile(id) {
        const user = await User.findByPk(id, {
            attributes: { exclude: ["password"] },
            include: [
                {
                    model: UserAddress,
                    as: "addresses",
                    separate: true,
                    order: [["is_default", "DESC"], ["id", "ASC"]]
                }
            ]
        });

        const plainUser = toPlainUser(user);
        if (!plainUser || plainUser.role !== "customer") return plainUser;

        const orders = await Order.findAll({
            where: { user_id: id },
            attributes: [
                "id",
                "user_id",
                "status",
                "return_status",
                "shipping_status",
                "subtotal",
                "total_amount",
                "delivered_at",
                "completed_at",
                "customer_received_at"
            ]
        });

        return decorateCustomer(
            plainUser,
            orders.map((order) => (order.get ? order.get({ plain: true }) : order))
        );
    },

    async updateProfile(id, data) {
        const user = await User.findByPk(id);
        if (!user) return null;

        const updateData = {};

        USER_UPDATE_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (Object.keys(updateData).length) {
            await user.update(updateData);
        }

        return this.getProfile(id);
    },

    async updateAdminUser(id, data) {
        const user = await User.findByPk(id);
        if (!user) return null;

        const updateData = {};

        ADMIN_USER_UPDATE_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updateData[field] = data[field];
            }
        });

        if (Object.prototype.hasOwnProperty.call(data, "password")) {
            updateData.password = data.password;
        }

        if (Object.keys(updateData).length) {
            await user.update(updateData);
        }

        return this.getProfile(id);
    },

    async removeUser(id) {
        const user = await User.findByPk(id);
        if (!user) return false;
        await user.destroy();
        return true;
    },

    async getAddresses(userId) {
        const addresses = await UserAddress.findAll({
            where: { user_id: userId },
            order: [["is_default", "DESC"], ["id", "ASC"]]
        });

        return addresses.map(toPlainAddress);
    },

    async getAddressById(userId, addressId) {
        const address = await UserAddress.findOne({
            where: {
                id: addressId,
                user_id: userId
            }
        });

        return toPlainAddress(address);
    },

    async createAddress(userId, data) {
        let addressId;

        await sequelize.transaction(async (transaction) => {
            const currentCount = await UserAddress.count({
                where: { user_id: userId },
                transaction
            });

            const isDefault = data.is_default === true || currentCount === 0;

            if (isDefault) {
                await UserAddress.update(
                    { is_default: false },
                    { where: { user_id: userId }, transaction }
                );
            }

            const address = await UserAddress.create({
                user_id: userId,
                full_name: data.full_name,
                phone: data.phone,
                address_line: data.address_line,
                ward: data.ward || null,
                district: data.district || null,
                city: data.city,
                is_default: isDefault
            }, { transaction });

            addressId = address.id;
        });

        return this.getAddressById(userId, addressId);
    },

    async updateAddress(userId, addressId, data) {
        const address = await UserAddress.findOne({
            where: {
                id: addressId,
                user_id: userId
            }
        });

        if (!address) return null;

        await sequelize.transaction(async (transaction) => {
            const updateData = {};

            ADDRESS_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    updateData[field] = data[field];
                }
            });

            if (updateData.is_default === true) {
                await UserAddress.update(
                    { is_default: false },
                    { where: { user_id: userId }, transaction }
                );
            }

            if (Object.keys(updateData).length) {
                await address.update(updateData, { transaction });
            }

            const defaultCount = await UserAddress.count({
                where: { user_id: userId, is_default: true },
                transaction
            });

            if (!defaultCount) {
                await address.update({ is_default: true }, { transaction });
            }
        });

        return this.getAddressById(userId, addressId);
    },

    async removeAddress(userId, addressId) {
        const address = await UserAddress.findOne({
            where: {
                id: addressId,
                user_id: userId
            }
        });

        if (!address) return false;

        await sequelize.transaction(async (transaction) => {
            const wasDefault = Boolean(address.is_default);

            await address.destroy({ transaction });

            if (wasDefault) {
                const fallbackAddress = await UserAddress.findOne({
                    where: { user_id: userId },
                    order: [["id", "ASC"]],
                    transaction
                });

                if (fallbackAddress) {
                    await fallbackAddress.update({ is_default: true }, { transaction });
                }
            }
        });

        return true;
    }
};

module.exports = UserModel;
