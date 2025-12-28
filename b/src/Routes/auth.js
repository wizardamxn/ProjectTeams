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
    const hash = await bcrypt.hash(req.body.password, 10);

    const creds = {
      fullName: req.body.fullName,
      email: req.body.email,
      password: hash,
      teamCode: req.body.teamCode,
    };

    await User.init(); // ensures unique index
    const user = new User(creds);
    await user.save();

    res.status(201).send("USER REGISTERED SUCCESSFULLY");
  } catch (err) {
    res.status(500).send("ERROR: " + err.message);
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
