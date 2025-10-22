const mongoose = require('mongoose');


const connectDB = async () => {
    await mongoose.connect(
        "mongodb+srv://amank225566:nq1oNFBKxRXiKfKu@wizardamxnxcluster.ovmio0y.mongodb.net/assignmentDB"
    )
}

module.exports = connectDB