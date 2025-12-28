import mongoose from "mongoose"

const connectDB = async () => {
    await mongoose.connect(
        "mongodb+srv://amank225566:nq1oNFBKxRXiKfKu@wizardamxnxcluster.ovmio0y.mongodb.net/assignmentDB"
    )
}

export default connectDB