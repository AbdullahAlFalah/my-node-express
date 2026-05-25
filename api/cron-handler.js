const { runVercelExport } = require('../scheduledjobs/vercelExportPurchases');
const { runVercelNotificationJob } = require('../scheduledjobs/vercelNotifications');

export default async function handler(req, res) {
  const { job } = req.query;

  const now = new Date();
  const isFirstMondayOfMonth = now.getDate() <= 7;

  try {
    // 1. Handle daily notification job
    if (job === 'daily') {
      // Run the daily notifications only
      const result = await runVercelNotificationJob(job);
      return res.status(200).json({ message: `Notifications (${job}) sent`, result });
    }

    // 2. For the weekly job, run notifications and check if it's the first Monday
    if (job === 'weekly') {
      // Run the weekly notifications first
      const result = await runVercelNotificationJob(job);

      // 3. If it's the first Monday, run the file export alongside it
      if (isFirstMondayOfMonth) {
        try {
          const fileId = await runVercelExport();
          // Both succeeded!
          console.log('The File ID:', fileId);
          return res.status(200).json({ message: 'Weekly notifications sent and Monthly export succeeded!', fileId, result });
        } catch (exportError) {
          console.error("Export sub-task failed:", exportError);
          // Notifications succeeded, but export failed. Return 200 but tell the truth!
          return res.status(200).json({
            message: 'Weekly notifications sent, but Monthly export failed!!!',
            exportError: exportError.message,
            result
          });
        }
      }

      // If it's a normal Monday (not the first of the month), just return the weekly status
      return res.status(200).json({ message: `Notifications (${job}) sent`, result });
    }

    // Fallback for invalid job types
    return res.status(400).send('Invalid job type');
  } catch (error) {
    console.error('Error occurred while handling cron job:', error);
    return res.status(500).json({ error: error.message });
  }
}
