const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

const convert = require('../utils/currencyConversion');

router.post('/api/wallet/addFunds', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { amount, currency } = req.body;

  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ ServerNote: 'Invalid amount!' }); // 400: Bad Request
  }

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500: Internal Server Error
    }

    // Check wallet status and currency before updating
    connection.query(
      'SELECT status, currency FROM wallets WHERE userId = ?',
      [userId],
      (err, results) => {
        if (err) {
          connection.release();         
          return res.status(500).json({ ServerNote: 'Error fetching wallet!' }); // 500: Internal Server Error
        }
        if (results.length === 0) {
          connection.release();
          return res.status(404).json({ ServerNote: 'Wallet not found!' }); // 404: Not Found
        }

        const walletStatus = results[0].status;
        const walletCurrency = results[0].currency;

        if (walletStatus !== 'active') {
          connection.release();
          return res.status(403).json({ ServerNote: 'Wallet is not active!' }); // 403: Forbidden (valid token, but not allowed)
        }

        if (walletCurrency !== currency) {
          // Convert the amount to the wallet's currency
          convert(parsedAmount, currency, walletCurrency)
          .then(convertedAmount => {
            connection.query(
              'UPDATE wallets SET balance = balance + ? WHERE userId = ?',
              [convertedAmount, userId],
              (err, result) => {
                connection.release();
                if (err) {                  
                  return res.status(500).json({ ServerNote: 'Error updating wallet after conversion:' + err.stack }); // 500: Internal Server Error
                } else {
                  return res.status(200).json({ 
                    ServerNote: `Funds added successfully! Converted ${parsedAmount} ${currency} to ${convertedAmount.toFixed(2)} ${walletCurrency}` 
                  }); // 200: OK
                }
              }
            );
          })
          .catch(err => {
            connection.release();
            // Conversion failed, now send 400 response
            return res.status(400).json({ 
              ServerNote: `Currency conversion failed or unsupported currency: Wallet currency mismatch: expected ${walletCurrency}` 
            }); // 400: Bad Request
          });  
          return;  
        }

        // Update wallet balance    
        connection.query(
          'UPDATE wallets SET balance = balance + ? WHERE userId = ?',
          [parsedAmount, userId],
          (err, result) => {
            connection.release();
            if (err) {
              console.error('Error updating wallet: ' + err.stack);
              return res.status(500).json({ ServerNote: 'Error updating wallet!' }); // 500: Internal Server Error
            } else {
              return res.status(200).json({ ServerNote: 'Funds added successfully!' }); // 200: OK
            }
          }
        );
      });
  });
});  

module.exports = router;

