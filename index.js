const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const pgsqlpool = require('./DifferentDatabases/postgreSQL');
const mysqlpool = require('./DifferentDatabases/MySQL');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ServerNote: 'Access denied. No token provided.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ ServerNote: 'Invalid token.' });
    }
    req.user = user; // Attach user info to the request
    next();
  });

};

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
app.post(`/api/users/signup`, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    outer_mysqlclient.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(400).json({ServerNote: 'Error creating user'});
        return;
      }
      res.status(201).json({ServerNote: 'User created successfully'}); // 201 Created: The request has succeeded, and a new resource was created, often used for successful POST requests.
    });
  } catch (error) {
    console.error('Error hashing password: ' + error.message);
    res.status(500).json({ ServerNote: 'Internal server error!!!' });
  }

});

// Login with an existing user route (Signing-in)
app.post(`/api/users/login`, (req, res) => {
  const { email, password } = req.body;

  outer_mysqlclient.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ServerNote: 'Server connection error!!'});
    }

    if (results.length === 0) {
      return res.status(401).json({ServerNote: 'User not found!'});
    }

    const user = results[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) { // user.password !== password can be used if password is not hashed
      return res.status(401).json({ServerNote: 'Invalid password!'});
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.idUsers}, SECRET_KEY, { expiresIn: '1h' }); // userId: user.idUsers, can be used if userId is not hashed
    res.status(200).json({ ServerNote: 'Logging-in has been successful', token, }); //200 OK: The request succeeded, and the server is returning the requested resource.
  });

});

// Protected route: Get all user info based on email route
app.get(`/api/users/getuserinfo`, authenticateToken, (req, res) => {
  const email = req.query.email; // Access email from the query parameters

  outer_mysqlclient.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
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

// Reset a user's password route based on userId
app.put(`/api/users/resetpassword/:id`, (req, res) => {
  const userId = req.params.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) { // Check if old and new passwords are provided
    return res.status(400).json({ ServerNote: 'Old and new passwords are required!' });
  }

  // First, get the user's current password
  outer_mysqlclient.query('SELECT password FROM users WHERE idUsers = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error fetching old password: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Server error fetching old password!' });
    }

    if (result.length === 0) {
      return res.status(404).json({ ServerNote: 'User not found!' });
    }

    const storedPassword = result[0].password;

    // Check if the old password matches
    if (storedPassword !== oldPassword) {
      return res.status(401).json({ ServerNote: 'Incorrect old password!' });
    }
    // If the old password matches, update to the new password
    outer_mysqlclient.query('UPDATE users SET password = ? WHERE idUsers = ?', [newPassword, userId], (err, result) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(400).json({ ServerNote: 'Error resetting password!' });
        return;
      }
      res.status(200).json({ ServerNote: 'Password reset successfully!' });
    });

  });

});

// Update an existing user route 
app.put(`/api/users/updateuserinfo/:id`, (req, res) => {
  const { username, email } = req.body;
  const userId = req.params.id;
  outer_mysqlclient.query('UPDATE users SET username = ?, email = ? WHERE idUsers = ?', [username, email, userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error updating user!'});
      return;
    }
    res.status(204).json({ServerNote: 'User updated successfully!!!'}); //204 No Content: The request was successful, but there's no content to return. Useful for actions like updates where no response body is needed.
  });
});

// Delete a user route
app.delete(`/api/users/deleteuserinfo/:id`, (req, res) => {
  const userId = req.params.id;
  outer_mysqlclient.query('DELETE FROM users WHERE idUsers = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(400).json({ServerNote: 'Error deleting user!'});
      return;
    }
    res.status(204).json({ServerNote: 'User deleted successfully!!!'});
  });
});

// PostgreSQL Routes:
// Get all films info route
app.get(`/api/films/getfilmsinfo`, authenticateToken, (req, res) => {
  const query = `SELECT film_id, title, description, length, replacement_cost, rating FROM film LIMIT 10`;

  outer_pgclient.query(query, (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Error fetching films!' });
    }

    res.status(200).json({
      ServerNote: 'Films fetched successfully!',
      data: result.rows, // Return the rows from the query result
    });

  });
});

// Route to fetch actors related to a specific film
app.get(`/api/films/:film_id/actors`, authenticateToken, (req, res) => {
  const filmId = req.params.film_id; // Get the film_id from the route parameter

  const query = `
    SELECT 
      a.actor_id, 
      a.first_name, 
      a.last_name
    FROM 
      actor a
    INNER JOIN 
      film_actor fa ON a.actor_id = fa.actor_id
    WHERE 
      fa.film_id = $1
  `;

  outer_pgclient.query(query, [filmId], (err, result) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Error fetching actors for the film!' });
    }

    res.status(200).json({
      ServerNote: 'Actors fetched successfully!',
      data: result.rows, // Return the rows from the query result
    });
    
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

