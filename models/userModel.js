const { Op } = require("sequelize");
const { sequelize, User, UserAddress } = require("./index");

const USER_UPDATE_FIELDS = ["username", "phone", "avatar_url"];
const ADDRESS_FIELDS = ["full_name", "phone", "address_line", "ward", "district", "city", "is_default"];

function toPlainUser(userInstance) {
    if (!userInstance) return null;
    return userInstance.get ? userInstance.get({ plain: true }) : userInstance;
}

function toPlainAddress(addressInstance) {
    if (!addressInstance) return null;
    return addressInstance.get ? addressInstance.get({ plain: true }) : addressInstance;
}

const UserModel = {
    createUser(username, email, password, extra = {}) {
        return User.create({ username, email, password, ...extra });
    },

    findByEmail(email) {
        return User.findOne({ where: { email } });
    },

    findById(id) {
        return User.findByPk(id);
    },

    async updatePassword(id, password) {
        const user = await User.findByPk(id);
        if (!user) return null;
        await user.update({ password });
        return user;
    },

    async getAll(filters = {}) {
        const where = {};

        if (filters.role) {
            where.role = filters.role;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.keyword) {
            where[Op.or] = [
                { username: { [Op.like]: `%${filters.keyword}%` } },
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

        return toPlainUser(user);
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