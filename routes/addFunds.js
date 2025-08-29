const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { runDbQuery } = require('../utils/mySqlQuery');

const convert = require('../utils/currencyConversion');

// POST /api/wallet
router.post('/api/wallet/addFunds', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { amount, currency } = req.body;

  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ ServerNote: 'Invalid amount!' }); // 400: Bad Request
  }

  try {
    // Step 1: Check wallet
    const results = await runDbQuery(
      'SELECT status, currency FROM wallets WHERE userId = ?',
      [userId]
    );
    
    // Check wallet status and currency before updating
    if (results.length === 0) {
      return res.status(404).json({ ServerNote: 'Wallet not found!' }); // 404: Not Found
    }

    const walletStatus = results[0].status;
    const walletCurrency = results[0].currency;

    if (walletStatus !== 'active') {
      return res.status(403).json({ ServerNote: 'Wallet is not active!' }); // 403: Forbidden (valid token, but not allowed)
    }

    let finalAmount = parsedAmount;
    let conversionNote = '';

    // Step 2: Convert if currency mismatch
    if (walletCurrency !== currency) {
      try {
        // Convert the amount to the wallet's currency
        finalAmount = await convert(parsedAmount, currency, walletCurrency);
        conversionNote = ` Converted ${parsedAmount} ${currency} to ${finalAmount.toFixed(2)} ${walletCurrency}.`;
      } catch (err) {
        // Conversion failed, now send 400 response
        return res.status(400).json({ 
          ServerNote: `Currency conversion failed or unsupported currency:\n${err.stack||err.message||err}.\nWallet currency mismatch: expected ${walletCurrency}` 
        }); // 400: Bad Request
      }
    }

    // Step 3: Update wallet balance
    await runDbQuery(
      'UPDATE wallets SET balance = balance + ? WHERE userId = ?',
      [finalAmount, userId]
    );

    return res.status(200).json({ 
      ServerNote: `Funds added successfully!${conversionNote}` 
    }); // 200: OK
                                                                
  } catch (error) {
    console.error(`[Wallet] Error updating funds: ${error.message}.`); // Server logs
    return res.status(500).json({ ServerNote: 'Internal server error while updating wallet funds!'}); // 500: Internal Server Error
  }
           
});

module.exports = router;
