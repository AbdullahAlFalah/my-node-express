const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  // DEBUG LOGS - Check these in Vercel
  console.log("--- New Auth Request ---");
  console.log("Method:", req.method);
  console.log("All Headers:", JSON.stringify(req.headers));
  
  const authHeader = req.headers['authorization'] || req.headers['Authorization']; // Handle case-insensitive header
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error("[AUTH ERROR] No token found in headers");
    return res.status(401).json({ ServerNote: 'Access denied. No token provided!' }); // 401: Unauthorized (missing token)
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      // This will tell us if it's "jwt malformed", "invalid signature", or "jwt expired"
      console.error(`[AUTH] Token verification failed: ${err.message}`);
      return res.status(401).json({ ServerNote: 'Invalid token: ', token }); // 401: Unauthorized (invalid token)
    }
    req.user = user; // Attach user info to the request
    next();
  });

};

module.exports = authenticateToken;

