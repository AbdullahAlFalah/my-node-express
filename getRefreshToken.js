const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'Keys', 'Oauth2_Node-to-Drive_Export_Client_ID.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const { client_secret, client_id } = require(CREDENTIALS_PATH).installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // very important for refresh token
  scope: SCOPES,
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Full token object:', tokens);
  } catch (err) {
    console.error('Error getting token:', err);
  }
});

