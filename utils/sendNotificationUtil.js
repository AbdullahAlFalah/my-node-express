const axios = require('axios');
// For Vercel deployment, we switch to a pure JavaScript MySQL client that doesn't require native bindings, ensuring compatibility and ease of deployment.
// const mysqlpool = require('../DifferentDatabases/MySQL');
const mysqlpool = require('../DifferentDatabases/vercelMySQL');

/**
 * Sends an Expo push notification to a user by email.
 * @param {string} email - The user's email.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
async function sendExpoNotification(email, title, body) {
    try {
        const results = await runDbQuery(
            'SELECT expoPushToken FROM user_push_tokens WHERE email = ? ORDER BY updatedAt DESC LIMIT 1',
            [email]
        );

        if (!results.length) {
            return { success: false, message: 'User not registered' };
        }

        const token = results[0].expoPushToken;
        return await sendExpoNotificationByToken(token, title, body);
    } catch (error) {
        return { success: false, message: 'Failed to fetch token' };
    }
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

        // Get the direct ticket result object from the array
        const ticket = response.data?.data?.[0];
        const status = ticket?.status;
        const success = status === 'ok';

        // 🚨 THE DELETE LOGIC GOES HERE:
        const details = ticket?.details;
        if (details && details.error === 'DeviceNotRegistered') {
            console.warn(`[Cleanup] Token has expired or app was uninstalled. Removing from DB: ${token}`);
            
            // Execute the delete query synchronously using the specific token string
            await runDbQuery('DELETE FROM user_push_tokens WHERE expoPushToken = ?', [token]);
            
            return { success: false, message: 'DeviceNotRegistered: Token removed from database' };
        }

        return { success, message: success ? 'Sent notification successfully' : 'Expo error', data: response.data };
    } catch (error) {
        console.error('Failed to send notification:', error);
        return { success: false, message: `Failed to send notification: ${error}` };
    }
}

module.exports = { sendExpoNotification, sendExpoNotificationByToken };
