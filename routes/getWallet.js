const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { runDbQuery } = require('../utils/mySqlQuery');

// GET /api/wallet
router.get('/api/wallet/getWalletinfo', authenticateToken, async (req, res) => {
    const userId = req.user.userId; 

    try {
        // Step 1: Fetch wallet
        const results = await runDbQuery(
            'SELECT * FROM wallets WHERE userId = ?',
            [userId]
        );

        if (results.length === 0) {
            console.log("🆕 No wallet found, creating new wallet entry...");

            const newWallet = {
                userId,
                balance: 0,
                currency: 'USD',
                status: 'active',
            };

            // Step 2: Create new wallet
            const insertResult = await runDbQuery(
                'INSERT INTO wallets (userId, balance, currency, status) VALUES (?, ?, ?, ?)',
                [newWallet.userId, newWallet.balance, newWallet.currency, newWallet.status]
            );

            // Step 3: Fetch the newly created wallet to get actual timestamps
            const [wallet] = await runDbQuery(
                'SELECT * FROM wallets WHERE userWalletId = ?',
                [insertResult.insertId]
            );

            if (!wallet) {
                console.error('❌ Wallet created but failed to fetch wallet info');
                return res.status(500).json({ ServerNote: 'Wallet created but failed to fetch wallet info.' }); // 500: Internal Server Error
            }

            return res.status(201).json({
                ServerNote: 'Wallet created!',
                walletInfo: wallet,
            }); // 201: Resource Created
        }

        // ✅ Wallet exists
        return res.status(200).json({
            ServerNote: 'Wallet info fetched!!!',
            walletInfo: results[0],
        }); // 200: OK

  } catch (error) {
    // Log the error and send a response
    console.error(`[Wallet] Error: ${error.message}.`); // Server logs
    return res.status(500).json({ ServerNote: 'Internal server error while fetching wallet!' }); // 500: Internal Server Error
  }

});

module.exports = router;

