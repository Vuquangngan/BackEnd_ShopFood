const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

async function cleanupSampleChats() {
    const sampleCustomer = await sequelize.query(
        `SELECT id, email FROM users WHERE email IN (:emails) LIMIT 1`,
        {
            replacements: {
                emails: ["customer@shopfood.vn", "customer@shopfood.com"]
            },
            type: QueryTypes.SELECT
        }
    );

    const customer = Array.isArray(sampleCustomer) ? sampleCustomer[0] : null;
    if (!customer) {
        console.log("Khong tim thay tai khoan khach hang mau de don dep chat.");
        return;
    }

    const conversationRows = await sequelize.query(
        `SELECT id FROM chat_conversations WHERE customer_id = :customerId`,
        {
            replacements: { customerId: customer.id },
            type: QueryTypes.SELECT
        }
    );

    const conversationIds = conversationRows.map((row) => Number(row.id)).filter(Boolean);
    if (!conversationIds.length) {
        console.log("Khong co hoi thoai mau nao can xoa.");
        return;
    }

    await sequelize.transaction(async (transaction) => {
        await sequelize.query(
            `DELETE FROM chat_messages WHERE conversation_id IN (:conversationIds)`,
            {
                replacements: { conversationIds },
                type: QueryTypes.DELETE,
                transaction
            }
        );

        await sequelize.query(
            `DELETE FROM notifications WHERE type = 'chat'`,
            {
                type: QueryTypes.DELETE,
                transaction
            }
        );

        await sequelize.query(
            `DELETE FROM chat_conversations WHERE id IN (:conversationIds)`,
            {
                replacements: { conversationIds },
                type: QueryTypes.DELETE,
                transaction
            }
        );
    });

    console.log(`Da xoa ${conversationIds.length} hoi thoai mau cua ${customer.email}.`);
}

cleanupSampleChats()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Khong the don dep chat mau:", error);
        process.exit(1);
    });
