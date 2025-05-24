const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/api/wallet/addFunds', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { amount, currency = 'USD' } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ ServerNote: 'Invalid amount!' });
  }

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' });
    }

    // Check wallet status and currency before updating
    connection.query(
      'SELECT status, currency FROM wallets WHERE userId = ?',
      [userId],
      (err, results) => {
        if (err || results.length === 0) {
          connection.release();
          return res.status(404).json({ ServerNote: 'Wallet not found!' });
        }

        const walletStatus = results[0].status;
        const walletCurrency = results[0].currency;

        if (walletStatus !== 'active') {
          connection.release();
          return res.status(403).json({ ServerNote: 'Wallet is not active!' });
        }

        if (walletCurrency !== currency) {
          connection.release();
          return res.status(400).json({ ServerNote: `Wallet currency mismatch: expected ${walletCurrency}` });
        }

        // Update wallet balance    
        connection.query(
          'UPDATE wallets SET balance = balance + ? WHERE userId = ?',
          [amount, userId],
          (err, result) => {
            connection.release();
            if (err) {
              console.error('Error updating wallet: ' + err.stack);
              return res.status(500).json({ ServerNote: 'Error updating wallet!' });
            }
            res.status(200).json({ ServerNote: 'Funds added successfully!' });
          }
        );
      });
  });
});  

module.exports = router;

