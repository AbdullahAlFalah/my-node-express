const { runVercelExport } = require('../scheduledjobs/vercelExportPurchases');
const { runVercelNotificationJob } = require('../scheduledjobs/vercelNotifications');

export default async function handler(req, res) {
  const { job } = req.query;

  // Security check for the external Monthly trigger (cron-job.org)
  if (job === 'export' && req.headers['x-api-key'] !== process.env.MY_CRON_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  try {
    if (job === 'export') {
      const fileId = await runVercelExport();
      return res.status(200).json({ message: 'Export successful', fileId });
    }

    if (job === 'daily' || job === 'weekly') {
      const result = await runVercelNotificationJob(job);
      return res.status(200).json({ message: `Notifications (${job}) sent`, result });
    }

    res.status(400).send('Invalid job type');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
