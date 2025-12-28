import mongoose from "mongoose"

const connectDB = async () => {
    await mongoose.connect(
        "mongodb+srv://amank225566:REMOVED@wizardamxnxcluster.ovmio0y.mongodb.net/assignmentDB"
    )
}

export default connectDB