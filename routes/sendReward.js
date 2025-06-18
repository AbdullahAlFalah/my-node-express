const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/api/rewards/reward-claim', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const rewardCoins = 10; // Fixed reward amount for simplicity

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection error' 
      });
    }

    // Start transaction
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({
          success: false,
          message: 'Transaction error'
        });
      }

      // Get current coin balance from the last reward record
      connection.query(
        'SELECT totalCoins FROM rewards WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId],
        (err, results) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({
                success: false,
                message: 'Error checking coin balance'
              });
            });
          }

          const totalCoins = results.length > 0 ? results[0].totalCoins : 0;
          const updatedCoins = totalCoins + rewardCoins;

          // Add new reward record
          connection.query(
            'INSERT INTO rewards (userId, rewardCoins, totalCoins) VALUES (?, ?, ?)',
            [userId, rewardCoins, updatedCoins],
            (err, result) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({
                    success: false,
                    message: 'Error adding coins'
                  });
                });
              }

              connection.commit(err => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({
                      success: false,
                      message: 'Error committing transaction'
                    });
                  });
                }

                connection.release();
                res.json({
                  success: true,
                  message: 'Coins added successfully',
                  reward: {
                    rewardCoins,
                    totalCoins: updatedCoins,
                    timestamp: new Date()
                  }
                });
              });
            }
          );
        }
      );
    });
  });
});

// Get user's coin history
router.get('/api/rewards/rewards-history', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  mysqlpool.query(
    'SELECT rewardCoins, totalCoins, createdAt FROM rewards WHERE userId = ? ORDER BY createdAt DESC',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching coin history'
        });
      }

      res.json({
        success: true,
        coinHistory: results
      });
    }
  );
});

module.exports = router;

