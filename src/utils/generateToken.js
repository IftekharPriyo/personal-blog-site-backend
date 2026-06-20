const jwt = require("jsonwebtoken");

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: COOKIE_MAX_AGE,
  path: "/",
});

const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
  res.cookie("jwt", token, cookieOptions());
  return token;
};

const clearTokenCookie = (res) => {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie("jwt", options);
};

module.exports = { generateToken, clearTokenCookie };
