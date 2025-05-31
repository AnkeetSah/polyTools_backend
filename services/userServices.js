const User = require('../models/User');

exports.findOrCreateGoogleUser = async (googleUser) => {
  const existingUser = await User.findOne({ googleId: googleUser.sub });
  if (existingUser) return existingUser;

  const newUser = new User({
    googleId: googleUser.sub,
    name: googleUser.name,
    email: googleUser.email,
    picture: googleUser.picture,
  });

  await newUser.save();
  return newUser;
};
