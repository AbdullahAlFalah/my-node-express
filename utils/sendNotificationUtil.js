const axios = require('axios');
const mysqlpool = require('../DifferentDatabases/MySQL');

/**
 * Sends an Expo push notification to a user by email.
 * @param {string} email - The user's email.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
async function sendExpoNotification(email, title, body) {
    return new Promise((resolve, reject) => {
        mysqlpool.query(
            'SELECT expoPushToken FROM user_push_tokens WHERE email = ?',
            [email],
            async (err, results) => {

                if (err) {
                    console.error('DB error:', err);
                    return resolve({ success: false, message: 'Failed to fetch token' });
                }
                
                if (!results.length) {
                    return resolve({ success: false, message: 'User not registered' });
                }

                const token = results[0].expoPushToken;
                resolve(await sendExpoNotificationByToken(token, title, body));
            }
        );
    });
}


/**
 * Sends an Expo push notification directly to a token.
 */
async function sendExpoNotificationByToken(token, title, body) {   
    try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send',
            {
                to: token,
                sound: 'default',
                title,
                body,
                channelId: 'default',
                priority: 'high', // optional, but helps for reliability on Android
                badge: 0 // optional, can be set if needed
            },
            {
                headers: {
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                }
            }
        );
        const status = response.data?.data?.status;
        const success = status === 'ok';
        return { success, message: success ? 'Sent notification successfully' : 'Expo error', data: response.data };
    } catch (error) {
        console.error('Failed to send notification:', error);
        return { success: false, message: `Failed to send notification: ${error}` };
    }
}

module.exports = { sendExpoNotification, sendExpoNotificationByToken };

