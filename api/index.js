// api/index.js: Main entry point for the Node.js application on Vercel. 

// Make sure .env is loaded
require('dotenv').config();

// Imported scheduled jobs
// DELETE OR COMMENT THESE OUT in api/index.js since Vercel runs the serverless function on demand and does not support long-running processes like cron jobs.
// Instead, I should deploy scheduled jobs as separate serverless functions or use an external scheduler like AWS CloudWatch Events, Google Cloud Scheduler, or a third-party service like cron-job.org to trigger these functions at the desired intervals.
// require('../scheduledjobs/exportPurchases');
// require('../scheduledjobs/sendScheduledNotifications');

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Swap bcrypt for bcryptjs. It is a pure JavaScript version that doesn't require compilation and works perfectly on Vercel.

// const pgsqlpool = require('../DifferentDatabases/vercelPostgreSQL');
// const mysqlpool = require('../DifferentDatabases/vercelMySQL');
const { runDbQuery } = require('../utils/mySqlQuery');
const { runPgQuery } = require('../utils/pgQuery');

// Imported custom routes
const purchaseRoutes = require('../routes/purchase');
const addFundsRoutes = require('../routes/addFunds');
const getWalletRoutes = require('../routes/getWallet');
const sendReward = require('../routes/sendReward');
const upgradeBackground = require('../routes/upgradeBackground');
const sendRemoteNotifications = require('../routes/sendRemoteNotifications');

// Imported custom utility functions
const { sendGreetingEmail } = require('../utils/sendEmail');

// const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware Usage
app.use(express.json());
// app.use(bodyParser.json());
app.use(cors({
  origin: '*', // Allows your Expo app to connect from any network
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'ServerNote', 'X-Foo', 'X-Bar'], // Explicitly expose headers
  credentials: false,
})); // Enable CORS for all routes

// Middleware to set Content-Type for all responses to application/json
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Imported custom middlewares
const authenticateToken = require('../middleware/authenticateToken');

// Root route to confirm backend is live
app.get('/', (req, res) => {
  res.status(200).json({
    ServerNote: 'Welcome to My Express API!',
    status: 'Online',
    timestamp: new Date().toISOString()
  });
});

// Custom Routes Usage
app.use('/api', purchaseRoutes);
app.use(addFundsRoutes);
app.use(getWalletRoutes);
app.use(sendReward);
app.use(upgradeBackground);
app.use(sendRemoteNotifications);

// Connect to MySQL for testing purposes
// mysqlpool.getConnection((err, mysqlclient) => {
//   if (err) {
//     console.error('Error connecting to MySQL: ' + err.stack);
//     return;
//   }
//   console.log('Connected to MySQL as ID ' + mysqlclient.threadId);
//   mysqlclient.release(); // ✅ Good practice, but not critical for a one-time test
// });

// Connect to PostgreSQL for testing purposes
// pgsqlpool.connect((err, pgclient, release) => {

//   if (err) {
//     console.error('Error connecting to PostgreSQL: ' + err.stack);
//     return;
//   }

//   // Get the process ID for the current PostgreSQL connection
//   pgclient.query('SELECT pg_backend_pid()', (err, result) => {   
//     if (err) {
//       console.error('Error getting current query: ' + err.stack);
//       return;
//     }
//     const pgConnectionId = result.rows[0].pg_backend_pid;
//     console.log('Connected to PostgreSQL as PID ' + pgConnectionId);
//     release(); // ✅ Always release after your test query
//   });

// });

// MySQL Routes:
// Create a new user route (Signing-up)
app.post(`/api/users/signup`, async (req, res) => {
  const { username, email, password } = req.body;

  try {

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await runDbQuery(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Send greeting email asynchronously (don't block on error)
    sendGreetingEmail(email, username)
      .then(() => console.log(`[Email] Greeting sent to ${email}`))
      .catch(e => console.error(`[Email] Failed to send greeting: ${e.message}`));

    res.status(201).json({ ServerNote: 'User created successfully' });

  } catch (error) {
    // Duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ServerNote: 'Email already exists!' });
    }
    res.status(500).json({ ServerNote: 'Internal server error while signing-up!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Login with an existing user route (Signing-in)
app.post(`/api/users/login`, async (req, res) => {
  const { email, password } = req.body;
    
  try {

    // Fetch user
    const results = await runDbQuery('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ServerNote: 'User not found!'}); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
    }

    const user = results[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);      
    if (!isPasswordValid) { // user.password !== password can be used if password is not hashed
      console.log(`[AUTH] Invalid password attempt for: ${email}`); // ADD THIS FOR VERCEL LOGS
      return res.status(401).json({ServerNote: 'Invalid password!'}); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.idUsers}, SECRET_KEY, { expiresIn: '24h' }); // userId: user.idUsers, can be used if userId is not hashed

    res.status(200).json({ ServerNote: 'Logging-in has been successful', token, }); //200 OK: The request succeeded, and the server is returning the requested resource.

  } catch (error) {
    res.status(500).json({ ServerNote: 'Internal server error while logging-in!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Protected route: Get all user info based on email route
app.get(`/api/users/getuserinfo`, authenticateToken, async (req, res) => {
  const email = req.query.email; // Access email from the query parameters

  try {

    const results = await runDbQuery('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(404).json({ServerNote: 'User not found!'}); // 404 Not Found: The server can not find the requested resource.
    }

    res.status(200).json({
      ServerNote: 'User info fetched!!!',
      data: results,
    }); // 200 OK: The request succeeded, and the server is returning the requested resource.

  } catch (error) {
    res.status(500).json({ ServerNote: 'Internal server error while fetching user!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Reset a user's password route based on userId
app.put(`/api/users/resetpassword/:id`, async (req, res) => {
  const userId = req.params.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) { // Check if old and new passwords are provided
    return res.status(400).json({ ServerNote: 'Old and new passwords are required!' }); // 400 Bad Request: The server cannot or will not process the request due to a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
  }

  try {

    // First, get the user's current password hash
    const results = await runDbQuery('SELECT password FROM users WHERE idUsers = ?', [userId]);

    if (results.length === 0) {
      return res.status(404).json({ ServerNote: 'User not found!' }); // 404 Not Found: The server can not find the requested resource.
    }

    const storedPassword = results[0].password;

    // Compare the current password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(oldPassword, storedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ ServerNote: 'Incorrect current password!' }); // 401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.
    }

    // Compare the new password with the stored hashed password to ensure they are different
    const isNewPasswordSameAsOld = await bcrypt.compare(newPassword, storedPassword);
    if (isNewPasswordSameAsOld) {
      return res.status(400).json({ ServerNote: 'New password must be different from the old password!' }); // 400 Bad Request: The server cannot or will not process the request due to a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
    }

    // If the old password matches (verification successful): 
    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    // Update to the new hashed password
    await runDbQuery('UPDATE users SET password = ? WHERE idUsers = ?', [hashedNewPassword, userId]);

    res.status(200).json({ ServerNote: 'Password reset successfully!' });
      
  } catch (error) {
    res.status(500).json({ ServerNote: 'Internal server error while reseting password!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Update an existing user route 
app.put(`/api/users/updateuserinfo/:id`, async (req, res) => {
  const { username, email } = req.body;
  const userId = req.params.id;

  try {

    await runDbQuery('UPDATE users SET username = ?, email = ? WHERE idUsers = ?', [username, email, userId]);

    res.status(200).json({ ServerNote: 'User updated successfully!!!' }); // 200 OK: The request succeeded, and the server is returning the requested resource.

  } catch (err) {
    res.status(500).json({ ServerNote: 'Internal server error while updating user!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// Delete a user route
app.delete(`/api/users/deleteuserinfo/:id`, async (req, res) => {
  const userId = req.params.id;

  try {

    await runDbQuery('DELETE FROM users WHERE idUsers = ?', [userId]);

    res.status(200).json({ ServerNote: 'User deleted successfully!!!' }); // 200 OK: The request succeeded, and the server is returning the requested resource.

  } catch (err) {
    res.status(500).json({ ServerNote: 'Internal server error while deleting user!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
  }

});

// PostgreSQL Routes:
// Get all films info route
app.get(`/api/films/getfilmsinfo`, authenticateToken, async (req, res) => {
  const query = `SELECT film_id, title, description, length, replacement_cost, rating FROM film LIMIT 10`;

    try {
      const results = await runPgQuery(query);
      res.status(200).json({
        ServerNote: 'Films fetched successfully!',
        data: results, // Return the rows from the query result (this is done now inside the runPgQuery function).
      }); // 200 OK: The request succeeded, and the server is returning the requested resource.
    } catch (error) {        
      return res.status(500).json({ ServerNote: 'Error fetching films!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

});

// Route to fetch actors related to a specific film
app.get(`/api/films/:film_id/actors`, authenticateToken, async (req, res) => {
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

    try {
      const results = await runPgQuery(query, [filmId]);
      res.status(200).json({
        ServerNote: 'Actors fetched successfully!',
        data: results, // Return the rows from the query result (this is done now inside the runPgQuery function).
      }); // 200 OK: The request succeeded, and the server is returning the requested resource.
    } catch (error) {
      return res.status(500).json({ ServerNote: 'Error fetching actors for the film!' }); // 500 Internal Server Error: The server encountered an unexpected condition that prevented it from fulfilling the request.
    }

});

// Health check route
app.get('/health', (req, res) => {
  console.log("Health check pinged");
  res.sendStatus(200); // Respond with HTTP 200 OK
});

// Export the app for Vercel
module.exports = app;

// Start the server
// REMOVE or COMMENT OUT the app.listen block when deploying to Vercel, as Vercel handles the server startup automatically.
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server is running on port ${PORT}`);
// });

// Gracefully handle process termination
// process.on("SIGINT", () => {
//   console.log("SIGINT received: Closing server...");
//   process.exit(0); // Exit the process
// });

// process.on("SIGTERM", () => {
//   console.log("SIGTERM received: Closing server...");
//   process.exit(0); // Exit the process
// });

