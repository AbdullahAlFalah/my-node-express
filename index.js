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
require('dotenv').config();
const fs = require('fs');
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10),
  ssl: { ca: fs.readFileSync(process.env.MYSQL_SSL_CA) }, //path to Aiven's CA certificate
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

// Connect to PostgreSQL
pgsql.connect((err, client) => {

  if (err) {
    console.error('Error connecting to PostgreSQL: ' + err.stack);
    return;
  }

  // Get the process ID for the current PostgreSQL connection
  client.query('SELECT pg_backend_pid()', (err, result) => {
    /* release(); // Release the client back to the pool */
    if (err) {
      console.error('Error getting current query: ' + err.stack);
      return;
    }
    const pgConnectionId = result.rows[0].pg_backend_pid;
    console.log('Connected to PostgreSQL as PID ' + pgConnectionId);
  });

});

// MySQL Routes:
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

