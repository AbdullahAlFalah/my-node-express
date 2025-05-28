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
      return res.status(500).json({ success: false, ServerNote: "Database connection error!" }); // 500: Internal Server Error
    }

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ success: false, ServerNote: "Transaction error!" }); // 500: Internal Server Error
      }

      // Fetch wallet 
      connection.query('SELECT balance, currency, status FROM wallets WHERE userId = ?', [userId], (err, results) => {
        if (err) {
          connection.rollback(() => connection.release());
          return res.status(500).json({ success: false, ServerNote: "Fetching wallet failed!" }); // 500: Internal Server Error
        }

        if (results.length === 0) {
          connection.rollback(() => connection.release());
          return res.status(404).json({ success: false, ServerNote: "Wallet not found!" }); // 404: Not Found
        }

        const balance = results[0].balance;
        const walletCurrency = results[0].currency;
        const walletStatus = results[0].status;

        if (walletStatus !== 'active') {
          connection.rollback(() => connection.release());
          return res.status(403).json({ success: false, ServerNote: "Wallet is not active!" }); // 403: Forbidden (valid token, but not allowed)
        }

        if (walletCurrency !== currency) {
          connection.rollback(() => connection.release());
          return res.status(400).json({ success: false, ServerNote: `Wallet currency mismatch: expected ${walletCurrency}` }); // 400: Bad Request
        }
        
        console.log(`DEBUG: Wallet balance: ${balance}, Total cost: ${totalCost}`);

        if (balance < totalCost) {
          connection.rollback(() => connection.release());
          return res.status(400).json({ success: false, ServerNote: "Insufficient funds" }); // 400: Bad Request
        }

        // Deduct wallet
        connection.query('UPDATE wallets SET balance = balance - ? WHERE userId = ?', [totalCost, userId], (err) => {
          if (err) {
            connection.rollback(() => connection.release());
            return res.status(500).json({ success: false, ServerNote: "Failed to deduct wallet" }); // 500: Internal Server Error
          }

          // Save purchase record
          const purchaseData = { userId, items: JSON.stringify(items), totalCost, currency, status: 'completed' };
          connection.query('INSERT INTO purchases SET ?', purchaseData, (err) => {
            if (err) {
              connection.rollback(() => connection.release());
              return res.status(500).json({ success: false, ServerNote: "Failed to save purchase" }); // 500: Internal Server Error
            }

            connection.commit((err) => {
              if (err) {
                connection.rollback(() => connection.release()); // Rollback transaction on commit error
                return res.status(500).json({ success: false, ServerNote: "Commit failed" }); // 500: Internal Server Error
              }
              connection.release();
              return res.status(200).json({ success: true, ServerNote: `Your new balance now is: ${balance - totalCost}` }); // 200: OK
            });
          });
        });
      });
    });
  });
});

module.exports = router;

