const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ServerNote: 'Access denied. No token provided!' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ ServerNote: 'Invalid token: ', token });
    }
    req.user = user; // Attach user info to the request
    next();
  });

};

module.exports = authenticateToken;

