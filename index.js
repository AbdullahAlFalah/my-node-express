const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const pgsqlpool = require('./DifferentDatabases/postgreSQL');
const mysqlpool = require('./DifferentDatabases/MySQL');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

let outer_mysqlclient;
let outer_pgclient;

// Connect to MySQL
mysqlpool.getConnection((err, mysqlclient) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  outer_mysqlclient = mysqlclient;
  console.log('Connected to MySQL as ID ' + mysqlclient.threadId);
});

// Connect to PostgreSQL
pgsqlpool.connect((err, pgclient) => {

  if (err) {
    console.error('Error connecting to PostgreSQL: ' + err.stack);
    return;
  }

  outer_pgclient = pgclient;

  // Get the process ID for the current PostgreSQL connection
  pgclient.query('SELECT pg_backend_pid()', (err, result) => {
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
// Create a new user route (Signing-up)
app.post(`/api/users/signup`, (req, res) => {
  const { username, email, password } = req.body;
  outer_mysqlclient.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error creating user'});
      return;
    }
    res.status(201).json({ServerNote: 'User created successfully'}); //201 Created: The request has succeeded, and a new resource was created, often used for successful POST requests.
  });
});

// Login with an existing user route (Signing-in)
app.post(`/api/users/login`, (req, res) => {
  const { email, password } = req.body;
  outer_mysqlclient.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ServerNote: 'Server connection error!!'});
    }

    if (results.length === 0) {
      return res.status(401).json({ServerNote: 'User not found!'});
    }

    const user = results[0];
    
    if (user.password !== password) {
      return res.status(401).json({ServerNote: 'Invalid password!'});
    }
    res.status(200).json({ ServerNote: 'Logging-in has been successful', userId: user.idUsers }); //200 OK: The request succeeded, and the server is returning the requested resource.
  });
});

// Get all user info based on email route
app.get(`/api/users/getuserinfo`, (req, res) => {
  const email = req.query.email; // Access email from the query parameters
  outer_mysqlclient.query('SELECT * FROM users WHERE email = ?', email, (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error fetching user info!'});
      return;
    }
    res.status(200).json({ServerNote: 'User info fetched!!!',
      data: results,
    });  
  });
});

// Update an existing user route 
app.put(`/api/users/updateuserinfo:id`, (req, res) => {
  const { username, email } = req.body;
  const userId = req.params.id;
  outer_mysqlclient.query('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error updating user!'});
      return;
    }
    res.status(204).json({ServerNote: 'User updated successfully!!!'}); //204 No Content: The request was successful, but there's no content to return. Useful for actions like updates where no response body is needed.
  });
});

// Delete a user route
app.delete(`/api/users/deleteuserinfo:id`, (req, res) => {
  const userId = req.params.id;
  outer_mysqlclient.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error deleting user!'});
      return;
    }
    res.status(204).json({ServerNote: 'User deleted successfully!!!'});
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

