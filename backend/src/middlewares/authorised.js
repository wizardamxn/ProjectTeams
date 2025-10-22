const jwt = require('jsonwebtoken')
const User = require('../models/user')


const authorised = async (req, res, next) => {
    try {
        const {token} = req.cookies
        const decoded = jwt.verify(token, "CHINGCHONG")
        const { _id } = decoded
        const user = await User.findById(_id);
        if (!user) {
            throw new Error("User not found");
        }
        else {
            req.user = user;
            next();
        }
    }
    catch (err) {
        console.log(err)
        res.status(401).send("Error: " + err);

    }
}


module.exports = authorised