function getUpgradeCost(level) {
    // Level 1 → 20, Level 2 → 40, Level 3 → 80
    const costs = [20, 40, 80];
    return costs[level - 1] || null;
}

module.exports = getUpgradeCost;

