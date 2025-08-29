const { runDbQuery } = require('../utils/mySqlQuery');

// Get the upgrade cost for a given level
function getUpgradeCost(level) {
    // Example: Level 1 → 10, Level 2 → 20, Level 3 → 30
    const costs = [10, 20, 30];
    return costs[level - 1] || null;
}

// Get the user's current background level
async function getCurrentLevel(userId) {
    const results = await runDbQuery(
        'SELECT currentLevel FROM user_background_upgrades WHERE userId = ?',
        [userId]
    );
    const currentLevel = results.length > 0 ? results[0].currentLevel : 0;
    return currentLevel; 
}

// Get the maximum background level available
async function getMaxLevel() {
    const results = await runDbQuery(
        'SELECT MAX(level) as maxLevel FROM background_upgrades_assets'
    );
    const maxLevel = results[0]?.maxLevel || 0;
    return maxLevel;
}

// Get the next background level (rotates to 0 after hitting the maximum level)
async function getNextLevel(userId) {
    const currentLevel = await getCurrentLevel(userId);
    const maxLevel = await getMaxLevel();
    const nextLevel = currentLevel >= maxLevel ? 0 : currentLevel + 1;
    return { currentLevel, nextLevel, maxLevel };
}

// Check if a level is owned by the user
async function isLevelOwned(userId, level) {
    const results = await runDbQuery(
        'SELECT ownedLevels FROM user_background_upgrades WHERE userId = ?',
        [userId]
    );
    const ownedMask = results.length > 0 ? results[0].ownedLevels : 0;
    const levelBit = 1 << level; // Create a bitmask for the level
    const isOwned = (ownedMask & levelBit) !== 0; // Check if the level bit is set
    return isOwned;    
}

module.exports = {
    getUpgradeCost,
    getCurrentLevel,
    getMaxLevel,
    getNextLevel,
    isLevelOwned
};
