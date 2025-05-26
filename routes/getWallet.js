const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

// GET /api/wallet
router.get('/api/wallet/getWalletinfo', authenticateToken, (req, res) => {
    const userId = req.user.userId; 

    res.json({
        ServerNote: "Dummy wallet info",
        walletInfo: {
            userWalletId: 1,
            balance: 100,
            currency: "USD",
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    });

    // mysqlpool.query(
    //     'SELECT * FROM wallets WHERE userId = ?',
    //     [userId],
    //     (err, results) => {
    //         if (err || results.length === 0) {
    //             console.error('Error executing query: ' + err.stack);
    //             res.status(400).json({ServerNote: 'Error fetching wallet info!'});
    //             return; 
    //         }
    //         res.status(200).json({ServerNote: 'Wallet info fetched!!!',
    //             walletInfo: results[0] 
    //         });
    //     }
    // );

});

module.exports = router;

