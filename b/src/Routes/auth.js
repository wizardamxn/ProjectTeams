import express from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";

const authRouter = express.Router();

/* ================= LOGIN ================= */
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send("Invalid Credentials");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      return res.status(401).send("Invalid Credentials");
    }

    const jwtToken = user.getJwtToken();

    res.cookie("token", jwtToken, {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
    });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).send("ERROR: " + err.message);
  }
});

/* ================= REGISTER ================= */
authRouter.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, teamCode } = req.body;

    // 1. Basic validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // 2. Normalize email
    const normalizedEmail = email.toLowerCase();

    // 3. Hash password
    const hash = await bcrypt.hash(password, 10);

    // 4. Create user
    await User.init(); // ensure indexes

    const user = await User.create({
      fullName,
      email: normalizedEmail,
      password: hash,
      teamCode,
    });

    // 5. Generate JWT
    const jwtToken = user.getJwtToken();

    // 6. Secure cookie settings (IMPORTANT)
    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.status(201).json({ message: "User registered successfully" });

  } catch (err) {

    // 7. Handle duplicate email error
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});


/* ================= LOGOUT ================= */
authRouter.post("/logout", (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    secure: true,
  });

  res.send("Logged out successfully");
});

export default authRouter;
