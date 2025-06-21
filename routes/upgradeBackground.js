const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');
const getUpgradeCost = require('../utils/backgroundScalingCost'); 

router.post('/api/background/upgrade', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database connection error' });
    }

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({ success: false, message: 'Transaction error' });
      }

      // 1. Get user's current background level
      connection.query(
        'SELECT currentLevel FROM user_background_upgrades WHERE userId = ?',
        [userId],
        (err, results) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ success: false, message: 'Error fetching upgrade level' });
            });
          }

          const currentLevel = results.length > 0 ? results[0].currentLevel : 0;
          const nextLevel = currentLevel + 1;

          if (nextLevel > 3) {
            connection.release();
            return res.status(400).json({ success: false, message: 'Maximum background level reached; Congrats!!!' });
          }

          const upgradeCost = getUpgradeCost(nextLevel);

          // 2. Get user's latest coin balance
          connection.query(
            'SELECT totalCoins FROM rewards WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
            [userId],
            (err, coinResults) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ success: false, message: 'Error fetching coin balance' });
                });
              }

              const totalCoins = coinResults.length > 0 ? coinResults[0].totalCoins : 0;

              if (totalCoins < upgradeCost) {
                connection.release();
                return res.status(400).json({ success: false, message: 'Not enough coins for upgrade.' });
              }

              // 3. Get asset for next level
              connection.query(
                'SELECT assetName, driveFileId FROM background_upgrades_assets WHERE level = ?',
                [nextLevel],
                (err, assetResults) => {
                  if (err || assetResults.length === 0) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ success: false, message: 'Asset not found for this level.' });
                    });
                  }

                  const { assetName, driveFileId } = assetResults[0];
                  const assetUrl = `https://drive.google.com/uc?id=${driveFileId}`;

                  // 4. Deduct coins: insert new reward record with updated total
                  const newTotalCoins = totalCoins - upgradeCost;
                  connection.query(
                    'INSERT INTO rewards (userId, rewardCoins, totalCoins) VALUES (?, ?, ?)',
                    [userId, -upgradeCost, newTotalCoins],
                    (err) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          res.status(500).json({ success: false, message: 'Error deducting coins.' });
                        });
                      }

                      // 5. Update or insert user's background level
                      connection.query(
                        'INSERT INTO user_background_upgrades (userId, currentLevel, upgradedAt) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE currentLevel = VALUES(currentLevel), upgradedAt = NOW()',
                        [userId, nextLevel],
                        (err) => {
                          if (err) {
                            return connection.rollback(() => {
                              connection.release();
                              res.status(500).json({ success: false, message: 'Error updating background level.' });
                            });
                          }

                          connection.commit(err => {
                            connection.release();
                            if (err) {
                              return res.status(500).json({ success: false, message: 'Error committing transaction.' });
                            }
                            res.json({
                              success: true,
                              message: `Background upgraded to level ${nextLevel}!`,
                              newLevel: nextLevel,
                              assetName,
                              assetUrl,
                              remainingCoins: newTotalCoins
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});

module.exports = router;

