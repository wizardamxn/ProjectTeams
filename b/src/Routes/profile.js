import express from 'express'
import authorised from '../middlewares/authorised.js'
import User from '../models/user.js'
import Chat from '../models/chat.js'


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

        // Plain objects (.lean()) so we can attach lastMessage and sort them.
        const members = await User.find({
            teamCode: teamCode,
            _id: { $ne: _id }
        }).select('fullName email').lean()

        // Only the chats THIS user is part of. `{ participants: _id }` matches
        // any chat whose participants array contains our id.
        const chats = await Chat.find({ participants: _id })
            .select('participants updatedAt')
            .lean()

        // Map: other participant's id -> when that chat last had activity.
        const lastByUser = new Map()
        for (const chat of chats) {
            const otherId = chat.participants
                .find(p => p.toString() !== _id.toString())
            if (otherId) {
                lastByUser.set(otherId.toString(), chat.updatedAt)
            }
        }

        // Stamp each member and sort newest conversation first.
        // Members you've never chatted with (null) sink to the bottom.
        for (const member of members) {
            member.lastMessage = lastByUser.get(member._id.toString()) ?? null
        }
        members.sort((a, b) => {
            return new Date(b.lastMessage ?? 0) - new Date(a.lastMessage ?? 0)
        })

        res.status(200).send(members)
    }
    catch (err) {
        console.error('Error fetching team members:', err)
        res.status(500).send("Can't get team members")
    }
})

export default profileRouter