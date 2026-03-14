const express = require('express');
const router = express.Router();
// For Vercel deployment, we switch to a pure JavaScript MySQL client that doesn't require native bindings, ensuring compatibility and ease of deployment.
// const mysqlpool = require('../DifferentDatabases/MySQL');
const mysqlpool = require('../DifferentDatabases/vercelMySQL');
const authenticateToken = require('../middleware/authenticateToken'); 

// POST /api/purchase
router.post('/purchase/purchaseitems', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Adjust according to the JWT payload
  const { items, currency = 'USD' } = req.body; // allow currency override, default to USD for testing

  // Input validation to ensure it is an array of items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, ServerNote: "No items provided to purchase!" }); // 400: Bad Request
  }

  // Validate the cost of each item
  for (const item of items) {
    if (typeof item.cost !== 'number' || item.cost <= 0) {
      return res.status(400).json({ 
        success: false, 
        ServerNote: "Invalid item cost provided!" 
      }); // 400: Bad Request
    }
  }

  // Calculate total cost
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);

  let connection;

  // Start MySQL transaction
  try {
    connection = await mysqlpool.promise().getConnection();
    await connection.beginTransaction();

    // Step 1: Fetch wallet
    const [walletResults] = await connection.query(
      'SELECT balance, currency, status FROM wallets WHERE userId = ?',
      [userId]
    );

    if (walletResults.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, ServerNote: "Wallet not found!" }); // 404: Not Found
    }

    const { balance, currency: walletCurrency, status: walletStatus } = walletResults[0];

    if (walletStatus !== 'active') {
      await connection.rollback();
      return res.status(403).json({ success: false, ServerNote: "Wallet is not active!" }); // 403: Forbidden (valid token, but not allowed)
    }

    console.log(`[Purchase] Debug: Wallet balance: ${balance}, Total cost: ${totalCost}`);

    if (walletCurrency !== currency) {
      await connection.rollback();
      return res.status(400).json({ success: false, ServerNote: `Wallet currency mismatch: expected ${walletCurrency}` }); // 400: Bad Request
    }

    if (balance < totalCost) {
      await connection.rollback();
      return res.status(400).json({ success: false, ServerNote: "Insufficient funds" }); // 400: Bad Request
    }

    // Step 2: Deduct balance
    await connection.query(
      'UPDATE wallets SET balance = balance - ? WHERE userId = ?',
      [totalCost, userId]
    );

    // Step 3: Save purchase record
    const purchaseData = { 
      userId, 
      items: JSON.stringify(items), 
      totalCost, 
      currency, 
      status: 'completed' 
    };
    await connection.query('INSERT INTO purchases SET ?', purchaseData);

    // Step 4: Fetch updated balance and commit
    const [updatedWallet] = await connection.query(
      'SELECT balance FROM wallets WHERE userId = ?',
      [userId]
    );
    await connection.commit();

    return res.status(200).json({
      success: true,
      ServerNote: `Purchase successful! Your new balance is ${updatedWallet[0].balance}`
    }); // 200: OK

  } catch (error) {
    if (connection) await connection.rollback();

    console.error('[Purchase] Error: ', error); // Server logs
    return res.status(500).json({
      success: false,
      ServerNote: "Internal server error during purchase!"
    }); // 500: Internal Server Error 

  } finally {
    if (connection) connection.release();
  }

});

module.exports = router;
