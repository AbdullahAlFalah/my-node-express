const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

// GET /api/wallet
router.get('/api/wallet/getWalletinfo', authenticateToken, (req, res) => {
    const userId = req.user.userId; 

    mysqlpool.query(
        'SELECT * FROM wallets WHERE userId = ?',
        [userId],
        (err, results) => {
            if (err) {
                // Log the error and send a response
                console.error('Error executing query: ' + err.stack);
                return res.status(500).json({ServerNote: 'Database error!'}); 
            }

            if (results.length === 0) {
                console.log("🆕 No wallet found, creating new wallet entry...");
                const newWallet = {
                    userId,
                    balance: 0,
                    currency: 'USD',
                    status: 'active',
                };

                mysqlpool.query(
                    'INSERT INTO wallets (userId, balance, currency, status) VALUES (?, ?, ?, ?)',
                    [newWallet.userId, newWallet.balance, newWallet.currency, newWallet.status],
                    (insertErr, insertResult) => {
                        if (insertErr) {
                            console.error('❌ Failed to create wallet:', insertErr.stack);
                            return res.status(501).json({ ServerNote: 'Failed to create wallet.' });
                        }

                        // Fetch the newly created wallet to get actual timestamps
                        mysqlpool.query(
                            'SELECT * FROM wallets WHERE userWalletId = ?',
                            [insertResult.insertId],
                            (fetchErr, fetchResults) => {
                                if (fetchErr || fetchResults.length === 0) {
                                    console.error('❌ Wallet created but failed to fetch wallet info:', fetchErr?.stack);
                                    return res.status(502).json({ ServerNote: 'Wallet created but failed to fetch wallet info.' });
                                }
                                return res.status(201).json({
                                    ServerNote: 'Wallet created!',
                                    walletInfo: fetchResults[0]
                                });
                            }
                        );
                    }
                );

            } else {
                return res.status(200).json({
                    ServerNote: 'Wallet info fetched!!!',
                    walletInfo: results[0] 
                });
            }
        }
    );

});

module.exports = router;

