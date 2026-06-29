const { sendExpoNotificationByToken } = require('../utils/sendNotificationUtil');
const { sendNotificationResultToAdmin } = require('../utils/sendEmail');
const { runDbQuery } = require('../utils/mySqlQuery');

async function runVercelNotificationJob(type) {
    const isWeekly = type === 'weekly';
    const title = isWeekly ? 'Weekly Reminder' : 'Daily Reminder';
    const body = isWeekly ? 'This is your weekly reminder!' : 'This is your friendly notification!';

    try {
        const results = await runDbQuery('SELECT email, expoPushToken FROM user_push_tokens');
        let allSuccess = true;
        const summary = [];

        for (const row of results) {
            if (!row.expoPushToken) continue;
            const result = await sendExpoNotificationByToken(row.expoPushToken, title, body);
            if (!result.success) allSuccess = false;
            summary.push({ email: row.email, success: result.success, message: result.message });
        }

        // If it's the weekly job, send the admin email
        if (isWeekly) {
            try {
                console.log("Attempting to send weekly admin summary email...");
                await sendNotificationResultToAdmin(summary);
                console.log("Admin summary email sent successfully!");
            } catch (emailError) {
                // Log the failure to Vercel Logs, but don't crash the function execution!
                console.error("Weekly admin email failed to send:", emailError.message);
            }
        }

        return { allSuccess, count: results.length };
    } catch (error) {
        throw new Error(`Notification Job Failed: ${error.message}`);
    }
}

module.exports = { runVercelNotificationJob };
