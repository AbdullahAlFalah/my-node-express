const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');
const { getUpgradeCost, getNextLevel, isLevelOwned } = require('../utils/backgroundUpgradeUtils'); 

router.post('/api/background/upgrade', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {

    const { nextLevel } = await getNextLevel(userId); // Get next level in the rotation
    const owned = await isLevelOwned(userId, nextLevel); // Check if owned

    mysqlpool.getConnection((err, connection) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database connection error' });
      }

      // 1. Fetch asset info for next level
      connection.query(
        'SELECT assetName, CDN_URL FROM background_upgrades_assets WHERE level = ?',
        [nextLevel],
        async (err, assetResults) => {
          if (err || assetResults.length === 0) {
              connection.release();
              return res.status(500).json({ success: false, message: 'Asset not found for this level.' });
          }
          const { assetName, CDN_URL } = assetResults[0];
          const assetUrl = CDN_URL;

          if (owned) {
            // Already owned: just rotate
            connection.release();
            return res.json({
              success: true,
              message: `Background rotated to level ${nextLevel}`,
              newLevel: nextLevel,
              assetName,
              assetUrl,
              owned: true
            });
          } else {
            // 2. Not owned: try to buy
            const upgradeCost = getUpgradeCost(nextLevel);
            connection.query(
              'SELECT totalCoins FROM rewards WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
              [userId],
              (err, coinResults) => {
                if (err) {
                  connection.release();
                  return res.status(500).json({ success: false, message: 'Error fetching coin balance' });
                }
                const totalCoins = coinResults.length > 0 ? coinResults[0].totalCoins : 0;
                if (totalCoins < upgradeCost) {
                  connection.release();
                  return res.status(400).json({
                    success: false,
                    message: 'Not enough coins to unlock this background.',
                    required: upgradeCost,
                    current: totalCoins
                  });
                }
                // Transaction to ensure atomicity:                                                                         
                connection.beginTransaction(err => {
                  if (err) {
                    connection.release();
                    return res.status(500).json({ success: false, message: 'Transaction error' });
                  }
                  const newTotalCoins = totalCoins - upgradeCost;
                  // 3. Deduct coins: insert new reward record with updated total
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
                      // 4. Insert or update user's background level 
                      connection.query(
                        `INSERT INTO user_background_upgrades 
                          (userId, currentLevel, ownedLevels, upgradedAt) 
                        VALUES (?, ?, ?, NOW()) 
                        ON DUPLICATE KEY UPDATE 
                          currentLevel = VALUES(currentLevel), 
                          ownedLevels = ownedLevels | VALUES(ownedLevels),
                          upgradedAt = NOW()`,
                        [userId, nextLevel, 1 << nextLevel], // Last entry sets the bit for the new level
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
                              message: `Background unlocked and rotated to level ${nextLevel}!`,
                              newLevel: nextLevel,
                              assetName,
                              assetUrl,
                              owned: true,
                              remainingCoins: newTotalCoins
                            });
                          });
                        }
                      );
                    }
                  );
                });                 
              }
            );
          }
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unexpected error', error: error.message });
  }
});

module.exports = router;

