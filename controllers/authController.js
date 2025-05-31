const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { findOrCreateGoogleUser } = require('../services/userServices');

exports.loginWithGoogle = (req, res) => {
  const baseURL = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`${baseURL}?${params.toString()}`);
};

exports.googleCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { id_token } = tokenRes.data;
    const userInfo = jwt.decode(id_token);

    const user = await findOrCreateGoogleUser(userInfo);

    const appToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.cookie('token', appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error('❌ Google Auth Failed:', err.message);
    res.status(500).send('Authentication Failed');
  }
};

exports.getUser = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
