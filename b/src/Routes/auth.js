import express from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";

const authRouter = express.Router();

// Shared cookie options so login, register, and logout never drift apart.
// Same-origin deployment => SameSite=Lax (also works cross-port in local dev).
// `secure` is decoupled from NODE_ENV: a Secure cookie is silently dropped over
// plain HTTP, so flip COOKIE_SECURE=true only once HTTPS is terminating in front.
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
  maxAge: 60 * 60 * 60 * 60 * 1000, // 1 hour
};

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

    res.cookie("token", jwtToken, cookieOptions);

    // Never ship the password hash back to the client.
    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(200).json(safeUser);
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

    // 6. Set auth cookie (same options as login — see cookieOptions above)
    res.cookie("token", jwtToken, cookieOptions);


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


/* ================= RESET PASSWORD ================= */
// No email infrastructure exists in this app, so password reset is verified
// via email + teamCode (the same "shared secret" used to join a team at signup)
// instead of an emailed token.
authRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, teamCode, newPassword } = req.body;

    if (!email || !teamCode || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), teamCode });
    if (!user) {
      return res.status(404).json({ message: "No account found with that email and team code" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ================= LOGOUT ================= */
authRouter.post("/logout", (req, res) => {
  // Clear with attributes matching how it was set, or the browser keeps it.
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });

  res.send("Logged out successfully");
});

export default authRouter;
