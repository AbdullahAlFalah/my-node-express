const cron = require('node-cron');
const { sendExpoNotificationByToken } = require('../utils/sendNotificationUtil');
const { sendNotificationResultToAdmin } = require('../utils/sendEmail');
const { runDbQuery } = require('../utils/mySqlQuery');

// Configuration constants
// Schedule expressions for cron jobs
const Notification_CRON = '0 */6 * * *'; // Runs once every 6 hour at 00 minutes (00:00, 06:00, 12:00, 18:00) (cron format: minute hour dayOfWeek Week dayOfWeek)
const Email_CRON = '30 0 * * 1'; // Runs once every week at 12:30 A.M every Monday (cron format: minute hour dayOfWeek Week dayOfWeek)

// Send notification to all users by token
async function sendToAllTokens(title, body) {
    try {
        const results = await runDbQuery('SELECT email, expoPushToken FROM user_push_tokens');

        let allSuccess = true;
        const summary = [];
        for (const row of results) {
            try {
                const result = await sendExpoNotificationByToken(row.expoPushToken, title, body);  
                if (!result.success) allSuccess = false;
                summary.push({
                    email: row.email,
                    success: result.success,
                    message: result.message
                });   
                console.log(`Notification result for ${row.email}:`, result.success ? 'Success' : 'Failed', result.message);          
            } catch (error) {
                allSuccess = false;
                summary.push({ email: row.email, success: false, message: err.message });
                console.error(`Notification result for ${row.email}: Error sending notification: ${err.message}`);
            }
        }
        // Return both status and summary           
        return{ allSuccess, summary };
    } catch (error) {
        console.error('Failed to fetch tokens for scheduled notifications:', error.message);
        throw error;
    }
}

// Scheduled job to send notifications to all users every hour
cron.schedule(Notification_CRON, async () => {
    // This runs at minute 0 of every hour
    console.log('[CRON] Hourly notification job started...');
    try {
        const { allSuccess } = await sendToAllTokens('Hourly Reminder', 'This is your Hourly notification!');

        if (allSuccess) {
            console.log('[CRON] ✅ All hourly notifications were sent successfully!!!');
        } else {
            console.warn('[CRON] ⚠️ Some hourly notifications failed to be sent!!!');
        }
    } catch (error) {
        console.error('[CRON] ❌ Hourly notification job failed:', err.message);
    }   
});

// Scheduled job to send report email to admin (myself) every Monday at 12:30 A.M
cron.schedule(Email_CRON, async () => {
    // This runs at minute 30 of hour 0 on every Monday (Midnight) 
    console.log('[CRON] Weekly summary email job started...');
    try {
        const { allSuccess, summary } = await sendToAllTokens('Weekly Reminder', 'This is your Weekly notification!');
        // Send one summary email to admin
        await sendNotificationResultToAdmin(summary);
        
        if (allSuccess) {
            console.log('[CRON] ✅ Weekly notifications sent & summary emailed to admin.');      
        } else {
            console.warn('[CRON] ⚠️ Some weekly notifications failed & summary emailed to admin.');
        }
    } catch (error) {
        console.error('[CRON] ❌ Weekly email job failed:', err.message);
    }
});

