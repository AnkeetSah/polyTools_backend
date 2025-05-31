require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const https = require('https');
const cors = require('cors');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(cookieParser());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// User model
const User = mongoose.model('User', new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  picture: String
}));

// Step 1: Redirect to Google login
app.get('/auth/google', (req, res) => {
  const params = querystring.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2: Handle Google callback
app.get('/auth/google/callback', (req, res) => {
  const code = req.query.code;

  const postData = querystring.stringify({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  const tokenReq = https.request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  }, tokenRes => {
    let body = '';
    tokenRes.on('data', chunk => body += chunk);
    tokenRes.on('end', async () => {
      const { access_token } = JSON.parse(body);

      // Fetch user info
      https.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`, async userRes => {
        let userData = '';
        userRes.on('data', chunk => userData += chunk);
        userRes.on('end', async () => {
          const userInfo = JSON.parse(userData);

          let user = await User.findOneAndUpdate(
            { googleId: userInfo.id },
            {
              googleId: userInfo.id,
              name: userInfo.name,
              email: userInfo.email,
              picture: userInfo.picture
            },
            { new: true, upsert: true }
          );

          // Create JWT and set as cookie
         // After successful login
const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  maxAge: 24 * 60 * 60 * 1000,
});

res.redirect(`${process.env.FRONTEND_URL}/home`);

        });
      });
    });
  });

  tokenReq.on('error', err => {
    console.error('❌ Token Request Error:', err);
    res.status(500).send('Google Authentication Failed');
  });

  tokenReq.write(postData);
  tokenReq.end();
});

// Route to get user from cookie
// /me endpoint
app.get('/me', async (req, res) => {
  try {
   
    // Check if token exists in cookies
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

// Server start
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
