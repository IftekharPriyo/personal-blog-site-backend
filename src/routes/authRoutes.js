const express = require("express");
const { register, login, logout } = require("../controllers/authController");
const { authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authorizeAdmin, logout);

// Dummy endpoint for checking that the authorization middleware works.
router.get("/protected", authorizeAdmin, (req, res) => {
  res.json({ message: "Authorization is working", user: req.user });
});

module.exports = router;
