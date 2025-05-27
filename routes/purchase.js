const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken'); 

// POST /api/purchase
router.post('/purchase/purchaseitems', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Adjust according to the JWT payload
  const { items, currency = 'USD' } = req.body; // allow currency override, default to USD

  // Calculate total cost
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  // Start MySQL transaction
  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ success: false, ServerNote: "Database connection error!" });
    }

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        return res.status(501).json({ success: false, ServerNote: "Transaction error!" });
      }

      // Fetch wallet 
      connection.query('SELECT balance, currency, status FROM wallets WHERE userId = ?', [userId], (err, results) => {
        if (err) {
          connection.rollback(() => connection.release());
          return res.status(502).json({ success: false, ServerNote: "Fetching wallet failed!" });
        }

        if (results.length === 0) {
          connection.rollback(() => connection.release());
          return res.status(404).json({ success: false, ServerNote: "Wallet not found!" });
        }

        const balance = results[0].balance;
        const walletCurrency = results[0].currency;
        const walletStatus = results[0].status;

        if (walletStatus !== 'active') {
          connection.rollback(() => connection.release());
          return res.status(401).json({ success: false, ServerNote: "Wallet is not active!" });
        }

        if (walletCurrency !== currency) {
          connection.rollback(() => connection.release());
          return res.status(402).json({ success: false, ServerNote: `Wallet currency mismatch: expected ${walletCurrency}` });
        }
        
        return res.status(200).json({ success: true, ServerNote: `Wallet balance: ${balance}, Total cost: ${totalCost}` });

        if (balance < totalCost) {
          connection.rollback(() => connection.release());
          return res.status(403).json({ success: false, ServerNote: "Insufficient funds" });
        }

        // Deduct wallet
        connection.query('UPDATE wallets SET balance = balance - ? WHERE userId = ?', [totalCost, userId], (err) => {
          if (err) {
            connection.rollback(() => connection.release());
            return res.status(503).json({ success: false, ServerNote: "Failed to deduct wallet" });
          }

          // Save purchase record
          const purchaseData = { userId, items: JSON.stringify(items), totalCost, currency, status: 'completed' };
          connection.query('INSERT INTO purchases SET ?', purchaseData, (err) => {
            if (err) {
              connection.rollback(() => connection.release());
              return res.status(504).json({ success: false, ServerNote: "Failed to save purchase" });
            }

            connection.commit((err) => {
              if (err) {
                connection.rollback(() => connection.release());
                return res.status(505).json({ success: false, ServerNote: "Commit failed" });
              }
              connection.release();
              return res.json({ success: true, ServerNote: `Your new balance now is: ${balance - totalCost}` });
            });
          });
        });
      });
    });
  });
});

module.exports = router;

