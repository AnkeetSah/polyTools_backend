const express = require('express');
const router = express.Router();
const { loginWithGoogle, googleCallback, getUser } = require('../controllers/authController');

router.get('/google', loginWithGoogle);
router.get('/google/callback', googleCallback);
router.get('/me', getUser); // optional

module.exports = router;
