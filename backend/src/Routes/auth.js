const express = require('express')
const User = require('../models/user')
// const { validateSignUpData } = require('../validateSignUpData')
const authRouter = express.Router()
const bcrypt = require('bcrypt')

authRouter.post('/login', async (req, res) => {

    try {
        const { email, password } = req.body
        const user = await User.findOne({ email: email })
        if (!user) {
            throw new Error("Invalid Credentials")
        }
        const isPasswordCorrect = await user.isPasswordCorrect(password)
        if (!isPasswordCorrect) {
            throw new Error("Invalid Credentials")
        }
        else {
            const jwttoken = user.getJwtToken()
            console.log(jwttoken)
            res.cookie('token', jwttoken,{
               maxAge: 60 * 60 * 1000
            })
            res.status(200).send(user)
        }
    }
    catch (err) {
        res.status(500).send("ERROR " + err)
    }
}
)

authRouter.post('/register', async (req, res) => {
    // validateSignUpData(req)
    try {
        const hash = await bcrypt.hash(req.body.password, 10)
        const creds = {
            fullName: req.body.fullName,
            email: req.body.email,
            password: hash,
            teamCode: req.body.teamCode
        };
        await User.init()
        const user = new User(creds)
        await user.save()
        res.send("USER REGISTERED SUCCESSFULLYLLYLYLY")



    }
    catch (err) {
        res.status(500).send("ERROR: " + err)
    }
})

authRouter.post('/logout', async (req, res) => {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
        httpOnly: true,
        secure: true
    });
    res.send("Logged out successfully");
});


module.exports = authRouter