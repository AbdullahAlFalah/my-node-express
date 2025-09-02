const { google } = require('googleapis');
const express = require('express');
const open = (...args) => import('open').then(module => module.default(...args)); // optional, auto-opens browser
const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.join(__dirname, 'Keys', 'Oauth2_Node-to-Drive_Export_Client_ID_Web.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(__dirname, 'Keys', 'token.json');

const { client_secret, client_id, redirect_uris } = require(CREDENTIALS_PATH).web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]); 

// Load token if it exists
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oAuth2Client.setCredentials(token);
  console.log('Loaded existing token:', TOKEN_PATH);
  process.exit(0); // safe, exits this script only
}

const app = express();
// This endpoint receives/GETs the code from Google
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code found in query.');

  try {
    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save token.json for future automated usage
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send('Authentication successful! You can close this tab.');
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Full token object:', tokens);
  } catch (err) {
    console.error('Error getting token:', err);
    res.send('Error retrieving token, check console.');
  } finally {
    // Close the server after handling the callback
    getAuthServer.close(() => {
      console.log('Server closed after OAuth callback.');
      process.exit(0); // exit script cleanly
    });
  }
});

// Automatically refreshes expired access tokens using the refresh token.
// You never need to manually reauthorize unless the refresh token itself is revoked.
oAuth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('Refreshed token saved!');
  }
});

// If no token exists, start authorization
if (!fs.existsSync(TOKEN_PATH)) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  console.log('Open this URL in your browser to authorize the app manually for the first time only:');
  console.log(authUrl);
  open(authUrl); // opens the auth URL automatically
}

const getAuthServer = app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});

