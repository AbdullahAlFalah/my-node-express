const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');
const sendExpoNotification = require('../utils/sendNotificationUtil');

// Register push token (with DB)
router.post('/api/notification/registerPushToken', authenticateToken, (req, res) => {
    const { email, expoPushToken } = req.body;
    const userId = req.user.userId;

    if (!expoPushToken || !email) {
        return res.status(400).json({ message: "expoPushToken and email are required." });
    }

    mysqlpool.query(
        `INSERT INTO user_push_tokens (userId, email, expoPushToken, updatedAt)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE expoPushToken = VALUES(expoPushToken), updatedAt = NOW()`,
        [userId, email, expoPushToken],
        async (err) => {
            if (err) {
                console.error('DB error:', err);
                return res.status(500).json({ message: 'Failed to register token' });
            }
            // Send a welcome notification after successful registration
            await sendExpoNotification(
                email,
                "Welcome!",
                "You will now receive push notifications."
            );
            res.json({ message: "Push token registered successfully and a notification is send." });
        }
    );

});

module.exports = router;
