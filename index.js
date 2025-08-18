// Make sure .env is loaded
require('dotenv').config();

// Imported scheduled jobs
require('./scheduledjobs/exportPurchases');
require('./scheduledjobs/sendScheduledNotifications');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const pgsqlpool = require('./DifferentDatabases/postgreSQL');
const mysqlpool = require('./DifferentDatabases/MySQL');

// Imported custom middlewares
const authenticateToken = require('./middleware/authenticateToken');

// Imported custom routes
const purchaseRoutes = require('./routes/purchase');
const addFundsRoutes = require('./routes/addFunds');
const getWalletRoutes = require('./routes/getWallet');
const sendReward = require('./routes/sendReward');
const upgradeBackground = require('./routes/upgradeBackground');
const sendRemoteNotifications = require('./routes/sendRemoteNotifications');

// Imported custom utility functions
const { sendGreetingEmail } = require('./utils/sendEmail');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware Usage
app.use(express.json());
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Custom Routes Usage
app.use('/api', purchaseRoutes);
app.use(addFundsRoutes);
app.use(getWalletRoutes);
app.use(sendReward);
app.use(upgradeBackground);
app.use(sendRemoteNotifications);

// Connect to MySQL for testing purposes
mysqlpool.getConnection((err, mysqlclient) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as ID ' + mysqlclient.threadId);
  mysqlclient.release(); // ✅ Good practice, but not critical for a one-time test
});

// Connect to PostgreSQL
pgsqlpool.connect((err, pgclient, release) => {

  if (err) {
    console.error('Error connecting to PostgreSQL: ' + err.stack);
    return;
  }

  // Get the process ID for the current PostgreSQL connection
  pgclient.query('SELECT pg_backend_pid()', (err, result) => {   
    if (err) {
      console.error('Error getting current query: ' + err.stack);
      return;
    }
    const pgConnectionId = result.rows[0].pg_backend_pid;
    console.log('Connected to PostgreSQL as PID ' + pgConnectionId);
    release(); // ✅ Always release after your test query
  });

});

// MySQL Routes:
// Create a new user route (Signing-up)
app.post(`/api/users/signup`, async (req, res) => {
  const { username, email, password } = req.body;

  try {

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    mysqlpool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting MySQL connection: ' + err.stack);
        return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }

      connection.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err, result) => {
        if (err) {
          console.error('Error executing query: ' + err.stack);
          // Check for duplicate email error
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ServerNote: 'Email already exists!'}); // 409 Conflict: The request could not be completed due to a conflict with the current state of the resource.         
          }
          return res.status(500).json({ServerNote: 'Error creating user'}); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.        
        }
        connection.release(); // Release the connection back to the pool
        // Send greeting email (don't block response on error)
        sendGreetingEmail(email, username)
          .then(() => console.log(`Greeting email sent to ${email}`))
          .catch(e => console.error('Failed to send greeting email:', e.message));
        res.status(201).json({ServerNote: 'User created successfully'}); // 201 Created: The request has succeeded, and a new resource was created, often used for successful POST requests.
      });

    });

  } catch (error) {
    console.error('Error hashing password: ' + error.message);
    res.status(500).json({ ServerNote: 'Internal server error!!!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Login with an existing user route (Signing-in)
app.post(`/api/users/login`, (req, res) => {
  const { email, password } = req.body;

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        return res.status(500).json({ServerNote: 'Server connection error!!'}); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }

      if (results.length === 0) {
        return res.status(401).json({ServerNote: 'User not found!'}); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
      }

      const user = results[0];

      // Compare the provided password with the hashed password in the database
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) { // user.password !== password can be used if password is not hashed
        return res.status(401).json({ServerNote: 'Invalid password!'}); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
      }

      // Generate a JWT token
      const token = jwt.sign({ userId: user.idUsers}, SECRET_KEY, { expiresIn: '24h' }); // userId: user.idUsers, can be used if userId is not hashed
      connection.release(); // Release the connection back to the pool
      res.status(200).json({ ServerNote: 'Logging-in has been successful', token, }); //200 OK: The request succeeded, and the server is returning the requested resource.
    });

  });

});

// Protected route: Get all user info based on email route
app.get(`/api/users/getuserinfo`, authenticateToken, (req, res) => {
  const email = req.query.email; // Access email from the query parameters

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }
  
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        return res.status(500).json({ServerNote: 'Error fetching user info!'}); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }
      if (results.length === 0) {
        return res.status(404).json({ServerNote: 'User not found!'}); // 404 Not Found: The server can not find the requested resource.
      }
      connection.release(); // Release the connection back to the pool
      res.status(200).json({ServerNote: 'User info fetched!!!',
        data: results,
      }); // 200 OK: The request succeeded, and the server is returning the requested resource. 
    });

  });

});

// Reset a user's password route based on userId
app.put(`/api/users/resetpassword/:id`, (req, res) => {
  const userId = req.params.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) { // Check if old and new passwords are provided
    return res.status(400).json({ ServerNote: 'Old and new passwords are required!' }); // 400 Bad Request: The server cannot or will not process the request due to a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
  }

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    // First, get the user's current password
    connection.query('SELECT password FROM users WHERE idUsers = ?', [userId], (err, result) => {
      if (err) {
        console.error('Error fetching old password: ' + err.stack);
        return res.status(500).json({ ServerNote: 'Server error fetching old password!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }

      if (result.length === 0) {
        return res.status(404).json({ ServerNote: 'User not found!' }); // 404 Not Found: The server can not find the requested resource.
      }

      const storedPassword = result[0].password;

      // Check if the old password matches
      if (storedPassword !== oldPassword) {
        return res.status(401).json({ ServerNote: 'Incorrect old password!' }); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
      }

      // If the old password matches, update to the new password
      connection.query('UPDATE users SET password = ? WHERE idUsers = ?', [newPassword, userId], (err, result) => {
        if (err) {
          console.error('Error executing query: ' + err.stack);
          res.status(500).json({ ServerNote: 'Error resetting password!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
          return;
        }
        res.status(200).json({ ServerNote: 'Password reset successfully!' }); // 200 OK: The request succeeded, and the server is returning the requested resource.
      });

      connection.release(); // Release the connection back to the pool
    });

  });

});

// Update an existing user route 
app.put(`/api/users/updateuserinfo/:id`, (req, res) => {
  const { username, email } = req.body;
  const userId = req.params.id;

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    connection.query('UPDATE users SET username = ?, email = ? WHERE idUsers = ?', [username, email, userId], (err, result) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(500).json({ServerNote: 'Error updating user!'}); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
        return;
      }
      connection.release(); // Release the connection back to the pool
      res.status(200).json({ServerNote: 'User updated successfully!!!'}); // 200 OK: The request succeeded, and the server is returning the requested resource.
    });

  });

});

// Delete a user route
app.delete(`/api/users/deleteuserinfo/:id`, (req, res) => {
  const userId = req.params.id;

  mysqlpool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    connection.query('DELETE FROM users WHERE idUsers = ?', [userId], (err, result) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(500).json({ServerNote: 'Error deleting user!'}); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
        return;
      }
      connection.release(); // Release the connection back to the pool
      res.status(200).json({ServerNote: 'User deleted successfully!!!'}); // 200 OK: The request succeeded, and the server is returning the requested resource.
    });

  });

});

// PostgreSQL Routes:
// Get all films info route
app.get(`/api/films/getfilmsinfo`, authenticateToken, (req, res) => {
  const query = `SELECT film_id, title, description, length, replacement_cost, rating FROM film LIMIT 10`;

  pgsqlpool.connect((err, client, release) => {
    if (err) {
      console.error('Error getting PostgreSQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    client.query(query, (err, result) => {
      release(); // Release the connection back to the pool
      if (err) {
        console.error('Error executing query: ' + err.stack);
        return res.status(500).json({ ServerNote: 'Error fetching films!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }

      res.status(200).json({
        ServerNote: 'Films fetched successfully!',
        data: result.rows, // Return the rows from the query result
      }); // 200 OK: The request succeeded, and the server is returning the requested resource.

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

  pgsqlpool.connect((err, client, release) => {
    if (err) {
      console.error('Error getting PostgreSQL connection: ' + err.stack);
      return res.status(500).json({ ServerNote: 'Database connection error!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

    client.query(query, [filmId], (err, result) => {
      release(); // Release the connection back to the pool       
      if (err) {
        console.error('Error executing query: ' + err.stack);
        return res.status(500).json({ ServerNote: 'Error fetching actors for the film!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
      }

      res.status(200).json({
        ServerNote: 'Actors fetched successfully!',
        data: result.rows, // Return the rows from the query result
      }); // 200 OK: The request succeeded, and the server is returning the requested resource.
    
    });

  });

});

// Health check route
app.get('/health', (req, res) => {
  console.log("Health check pinged");
  res.sendStatus(200); // Respond with HTTP 200 OK
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// Gracefully handle process termination
process.on("SIGINT", () => {
  console.log("SIGINT received: Closing server...");
  process.exit(0); // Exit the process
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received: Closing server...");
  process.exit(0); // Exit the process
});

