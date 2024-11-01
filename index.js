const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const pgsql = require('./DifferentDatabases/postgreSQL');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// MySQL Connection
const fs = require('fs');
const db = mysql.createConnection({
  host: 'mysql-125eea42-salem908mk-1066.l.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS_2b8kGbPM5zsLnfLD87n',
  database: 'defaultdb',
  port: '11746',
  ssl: { ca: fs.readFileSync('./ca.pem') }, //path to Aiven's CA certificate
  connectTimeout: 10000
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as ID ' + db.threadId);
});

// Routes:
// Get all users route
app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(500).send('Error fetching users');
      return;
    }
    res.json(results);
  });
});

// Create a new user route (Signing-up)
app.post('/api/users', (req, res) => {
  const { username, email, password } = req.body;
  db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error creating user'});
      return;
    }
    res.status(201).json({ServerNote: 'User created successfully'});
  });
});

// Update an existing user route 
app.put('/api/users/:id', (req, res) => {
  const { username, email } = req.body;
  const userId = req.params.id;
  db.query('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).send('Error updating user');
      return;
    }
    res.send('User updated successfully');
  });
});

// Delete a user route
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  db.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).send('Error deleting user');
      return;
    }
    res.send('User deleted successfully');
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

