import express from 'express'
import authorised from '../middlewares/authorised.js'
import User from '../models/user.js'


const profileRouter = express.Router()


profileRouter.get('/profile', authorised, async (req, res) => {
    try {
        const { user } = req
        res.status(200).send(user)
    }
    catch (err) {
        res.status(500).send("Error while getting the profile.")
    }
})



profileRouter.get("/auth/me", authorised, (req, res) => {
    res.json({ user: req.user }); // decoded from JWT
});

profileRouter.get('/teammembers', authorised, async (req, res) => {
    try {
        const { _id, teamCode } = req.user

        const members = await User.find({
            teamCode: teamCode,
            _id: { $ne: _id }
        }).select('fullName email')

        res.status(200).send(members)
    }
    catch (err) {
        console.error('Error fetching team members:', err)
        res.status(500).send("Can't get team members")
    }
})



export default profileRouter