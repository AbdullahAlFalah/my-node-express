const express = require('express');
const router = express.Router();
const { runDbQuery } = require('../utils/mySqlQuery');
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');
const { getUpgradeCost, getNextLevel, isLevelOwned } = require('../utils/backgroundUpgradeUtils'); 

router.post('/api/background/upgrade', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  let connection;
  let transactionStarted = false;

  try {

    // Step 1: figure out next level and it's ownership
    const { nextLevel } = await getNextLevel(userId); // Get next level in the rotation
    const owned = await isLevelOwned(userId, nextLevel); // Check if owned

    // Step 2: Fetch asset info for next level
    const assetResults = await runDbQuery(
      'SELECT assetName, CDN_URL FROM background_upgrades_assets WHERE level = ?',
      [nextLevel]
    );

    if (assetResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found for this level.' }); // 404: Not Found
    }

    const { assetName, CDN_URL: assetUrl } = assetResults[0];

    if (owned) {
      // Already owned: just rotate by updating only the currentLevel
      await runDbQuery(
        `UPDATE user_background_upgrades 
        SET currentLevel = ?, upgradedAt = NOW()
        WHERE userId = ?`,
        [nextLevel, userId]
      );

      return res.json({
        success: true,
        message: `Background rotated to level ${nextLevel}`,
        newLevel: nextLevel,
        assetName,
        assetUrl,
        owned: true
      });
    }

    // Step 3: Not owned: try to buy
    const upgradeCost = getUpgradeCost(nextLevel);

    // Get current coins
    const coinResults = await runDbQuery(
      'SELECT totalCoins FROM rewards WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [userId]
    );

    const totalCoins = coinResults.length > 0 ? coinResults[0].totalCoins : 0;

    if (totalCoins < upgradeCost) {
      return res.status(400).json({
        success: false,
        message: 'Not enough coins to unlock this background.',
        required: upgradeCost,
        current: totalCoins
      }); // 400 Bad Request
    }

    // Start transaction here to ensure atomicity for sensitive changes
    // Begin transaction for purchase using connection directly and flag it
    connection = await mysqlpool.promise().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const newTotalCoins = totalCoins - upgradeCost; // The new updated total

    // Step 4: Deduct coins by inserting new reward record with updated total
    await connection.query(
      'INSERT INTO rewards (userId, rewardCoins, totalCoins) VALUES (?, ?, ?)',
      [userId, -upgradeCost, newTotalCoins]
    );
    
    // Step 5: Insert or update user's background level and commit
    await connection.query(
      `INSERT INTO user_background_upgrades 
        (userId, currentLevel, ownedLevels, upgradedAt) 
      VALUES (?, ?, ?, NOW()) 
      ON DUPLICATE KEY UPDATE 
        currentLevel = VALUES(currentLevel), 
        ownedLevels = ownedLevels | VALUES(ownedLevels),
        upgradedAt = NOW()`,
        [userId, nextLevel, 1 << nextLevel] // Last entry sets the bit for the new level
    );
    await connection.commit();

    return res.json({
      success: true,
      message: `Background unlocked and rotated to level ${nextLevel}!`,
      newLevel: nextLevel,
      assetName,
      assetUrl,
      owned: true,
      remainingCoins: newTotalCoins
    });

  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();

    console.error('[BackgroundUpgrade] Error: ', error); // Server logs
    return res.status(500).json({
      success: false,
      ServerNote: "Internal server error while upgrading background!"
    }); // 500: Internal Server Error

  } finally {
    if (connection) connection.release();
  }
    
});

module.exports = router;
