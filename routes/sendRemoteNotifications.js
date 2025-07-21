const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');
const sendExpoNotification = require('../utils/sendNotificationUtil');

// Register push token (with DB)
router.post('/api/notification/registerPushToken', authenticateToken, (req, res) => {
    const { expoPushToken } = req.body;
    const userId = req.user.userId;

    if (!expoPushToken || !userId) {
        return res.status(400).json({ message: "expoPushToken and userId are required." });
    }

    // Step 1: Get the user's email from the database
    mysqlpool.query(
        'SELECT email FROM users WHERE id = ?',
        [userId],
        (err, results) => {
            if (err) {
                console.log('DB error while fetching email:', err);
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const email = results[0].email;

            // Step 2: Insert or update token in the database
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

        }
    );

});

module.exports = router;
