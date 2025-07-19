const cron = require('node-cron');
const { sendExpoNotificationByToken } = require('../utils/sendNotificationUtil');
const { sendNotificationResultToAdmin } = require('../utils/sendEmail');
const mysqlpool = require('../DifferentDatabases/MySQL');

// Configuration constants
// Schedule expressions for cron jobs
const Notification_CRON = '0 * * * *'; // Runs once every hour at 00 minutes (cron format: minute hour dayOfWeek Week dayOfWeek)
const Email_CRON = '30 0 * * 1'; // Runs once every week at 12:30 A.M every Monday (cron format: minute hour dayOfWeek Week dayOfWeek)

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
            // Return both status and summary           
            resolve({ allSuccess, summary });
        });
    });
}

// Scheduled job to send notifications to all users every hour
cron.schedule(Notification_CRON, async () => {
    // This runs at minute 0 of every hour
    const { allSuccess } = await sendToAllTokens('Hourly Reminder', 'This is your Hourly notification!');
    if (allSuccess) {
        console.log('All notifications sent successfully!!!');
    } else {
        console.error('Some notifications failed to be sent!!!');
    }   
});

// Scheduled job to send report email to admin (myself) every Monday at 12:30 A.M
cron.schedule(Email_CRON, async () => {
    // This runs at minute 30 of hour 0 on every Monday (Midnight) 
    console.log('Weekly summary email cron job started...');
    const { allSuccess, summary } = await sendToAllTokens('Weekly Reminder', 'This is your Weekly notification!');
    if (allSuccess) {
        console.log('All notifications sent successfully!!!');
        // Send one summary email to admin
        await sendNotificationResultToAdmin(summary);       
    } else {
        console.error('Some notifications failed to be sent!!!');
        // Send one summary email to admin
        await sendNotificationResultToAdmin(summary);
    } 
});

