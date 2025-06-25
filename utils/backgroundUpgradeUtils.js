const mysqlpool = require('../DifferentDatabases/MySQL');

function getUpgradeCost(level) {
    // Level 1 → 20, Level 2 → 40, Level 3 → 80
    const costs = [20, 40, 80];
    return costs[level - 1] || null;
}

// Get the user's current background level
function getCurrentLevel(userId) {
    return new Promise((resolve, reject) => {
        mysqlpool.query(
            'SELECT currentLevel FROM user_background_upgrades WHERE userId = ?',
            [userId],
            (err, results) => {
                if (err) return reject(err);
                const currentLevel = results.length > 0 ? results[0].currentLevel : 0;
                resolve(currentLevel);
            }
        );
    });
}

// Get the max background level available (Promise)
function getMaxLevel() {
    return new Promise((resolve, reject) => {
        mysqlpool.query(
            'SELECT MAX(level) as maxLevel FROM background_upgrades_assets',
            [],
            (err, results) => {
                if (err) return reject(err);
                const maxLevel = results[0]?.maxLevel || 0;
                resolve(maxLevel);
            }
        );
    });
}

// Get the next background level (rotates to 0 after hitting the maximum level)
async function getNextLevel(userId) {
    const currentLevel = await getCurrentLevel(userId);
    const maxLevel = await getMaxLevel();
    const nextLevel = currentLevel >= maxLevel ? 0 : currentLevel + 1;
    return { currentLevel, nextLevel, maxLevel };
}

// Check if a level is owned by the user
function isLevelOwned(userId, level) {
    return new Promise((resolve, reject) => {
        mysqlpool.query(
            'SELECT currentLevel FROM user_background_upgrades WHERE userId = ?',
            [userId],
            (err, results) => {
                if (err) return reject(err);
                const ownedLevel = results.length > 0 ? results[0].currentLevel : 0;
                resolve(level <= ownedLevel);
            }
        );
    });
}

module.exports = {
    getUpgradeCost,
    getCurrentLevel,
    getMaxLevel,
    getNextLevel,
    isLevelOwned
};

