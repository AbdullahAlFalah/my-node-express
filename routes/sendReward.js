const express = require('express');
const router = express.Router();
// For Vercel deployment, we switch to a pure JavaScript MySQL client that doesn't require native bindings, ensuring compatibility and ease of deployment.
// const mysqlpool = require('../DifferentDatabases/MySQL');
const mysqlpool = require('../DifferentDatabases/vercelMySQL');
const authenticateToken = require('../middleware/authenticateToken');
const { runDbQuery } = require('../utils/mySqlQuery');

// Claim reward route
router.post('/api/rewards/reward-claim', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const rewardCoins = 10; // Fixed reward amount for simplicity

  let connection;

  try {
    connection = await mysqlpool.promise().getConnection();
    await connection.beginTransaction();

    // Step 1: Get current coin balance from the last reward record
    const [results] = await connection.query(
      'SELECT totalCoins FROM rewards WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const totalCoins = results.length > 0 ? results[0].totalCoins : 0;
    const updatedCoins = totalCoins + rewardCoins;

    // Step 2: Add new reward record
    await connection.query(
      'INSERT INTO rewards (userId, rewardCoins, totalCoins) VALUES (?, ?, ?)',
      [userId, rewardCoins, updatedCoins]
    );

    // Step 3: Commit and return response
    await connection.commit();
    return res.json({
      success: true,
      message: 'Coins added successfully',
      reward: {
        rewardCoins,
        totalCoins: updatedCoins,
        timestamp: new Date()
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();

    console.error('[Reward] Error: ', error); // Server logs
    return res.status(500).json({
      success: false,
      ServerNote: "Internal server error while claiming reward!"
    }); // 500: Internal Server Error

  } finally {
    if (connection) connection.release();
  }

});


// Get user's coin history
router.get('/api/rewards/rewards-history', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const results = await runDbQuery(
      `SELECT rewardCoins, totalCoins, createdAt 
      FROM rewards 
      WHERE userId = ? 
      ORDER BY createdAt DESC`,
      [userId],
    );

    return res.json({
      success: true,
      coinHistory: results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching coin history!'
    }); // 500: Internal Server Error
  }

});

module.exports = router;
