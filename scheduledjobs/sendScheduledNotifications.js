const cron = require('node-cron');
const { sendExpoNotificationByToken } = require('../utils/sendNotificationUtil');
const { sendNotificationResultToAdmin } = require('../utils/sendEmail');
const mysqlpool = require('../DifferentDatabases/MySQL');

// Configuration constants
const CRON_SCHEDULE = '0 * * * *'; // Runs once every hour (cron format: minute hour dayOfMonth month dayOfWeek)

// Send notification to all users by token
async function sendToAllTokens(title, body) {
    return new Promise((resolve, reject) => {
        mysqlpool.query('SELECT email, expoPushToken FROM user_push_tokens', async (err, results) => {
            if (err) {
                console.error('Failed to fetch tokens for scheduled notifications:', err);
                return reject(err);
            }
            let allSuccess = true;
            const summary = [];
            for (const row of results) {
                const result = await sendExpoNotificationByToken(row.expoPushToken, title, body);  
                if (!result.success) allSuccess = false;
                summary.push({
                    email: row.email,
                    success: result.success,
                    message: result.message
                });   
                console.log(`Notification result for ${row.email}:`, result.success ? 'Success' : 'Failed', result.message);          
            }  
            // Send one summary email to admin
            await sendNotificationResultToAdmin(summary);            
            resolve(allSuccess);
        });
    });
}

// Scheduled job to send notifications to all users every hour
cron.schedule(CRON_SCHEDULE, async () => {
    // This runs at minute 0 of every hour
    const allOk = await sendToAllTokens('Monthly Reminder', 'This is your Monthly notification!');
    if (allOk) {
        console.log('All notifications sent successfully!!!');
    } else {
        console.error('Some notifications failed to be sent!!!');
    }   
});

