const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken'); 

// POST /api/purchase
router.post('/purchase/purchaseitems', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Adjust according to your JWT payload
  const { items } = req.body;

  // Calculate total cost
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  // Start MySQL transaction
  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ success: false, error: "Database connection error!" });
    }

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ success: false, error: "Transaction error!" });
      }

      // Fetch wallet balance
      connection.query('SELECT wallet FROM users WHERE idUsers = ?', [userId], (err, results) => {
        if (err || results.length === 0) {
          connection.rollback(() => connection.release());
          return res.status(400).json({ success: false, error: "User not found" });
        }

        const wallet = results[0].wallet;
        if (wallet < totalCost) {
          connection.rollback(() => connection.release());
          return res.status(400).json({ success: false, error: "Insufficient funds" });
        }

        // Deduct wallet
        connection.query('UPDATE users SET wallet = wallet - ? WHERE idUsers = ?', [totalCost, userId], (err) => {
          if (err) {
            connection.rollback(() => connection.release());
            return res.status(500).json({ success: false, error: "Failed to deduct wallet" });
          }

          // Save purchase record
          const purchaseData = { userId, items: JSON.stringify(items), totalCost };
          connection.query('INSERT INTO purchases SET ?', purchaseData, (err) => {
            if (err) {
              connection.rollback(() => connection.release());
              return res.status(500).json({ success: false, error: "Failed to save purchase" });
            }

            connection.commit((err) => {
              if (err) {
                connection.rollback(() => connection.release());
                return res.status(500).json({ success: false, error: "Commit failed" });
              }
              connection.release();
              return res.json({ success: true, newBalance: wallet - totalCost });
            });
          });
        });
      });
    });
  });
});

module.exports = router;

