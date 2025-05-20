const express = require('express');
const router = express.Router();
const mysqlpool = require('../DifferentDatabases/MySQL');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/api/users/:id/addfunds', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ ServerNote: 'Invalid amount!' });
  }

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' });
    }

    connection.query(
      'UPDATE users SET wallet = wallet + ? WHERE idUsers = ?',
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

module.exports = router;

