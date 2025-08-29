const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { sendPushNotificationRegistrationEmail } = require('../utils/sendEmail');
const { runDbQuery } = require('../utils/mySqlQuery');

// Register push token (with DB)
router.post('/api/notification/registerPushToken', authenticateToken, async (req, res) => {
    const { expoPushToken } = req.body;
    const userId = req.user.userId;

    if (!expoPushToken || !userId) {
        return res.status(400).json({ message: "expoPushToken and userId are required." }); // 400: Bad Request
    }

    try {
        // Step 1: Get the user's email from the database
        const results = await runDbQuery(
            'SELECT email FROM users WHERE idUsers = ?',
            [userId]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' }); // 404: Not Found
        }

        const email = results[0].email;

        // Step 2: Insert or update token in the database
        await runDbQuery(
            `INSERT INTO user_push_tokens (userId, email, expoPushToken, updatedAt)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE expoPushToken = VALUES(expoPushToken), updatedAt = NOW()`,
            [userId, email, expoPushToken]
        );

        // Step 3: Send a welcome email after successful registration
        await sendPushNotificationRegistrationEmail(email);

        res.status(200).json({ message: "Push token registered successfully and an email is sent." }); // 200: OK
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error during push token registration!' }); // 500: Internal Server Error
    }

});

module.exports = router;
