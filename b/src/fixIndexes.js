import mongoose from "mongoose";
import User from "./models/user.js"; // adjust path to your schema

const MONGO_URI = "mongodb+srv://amank225566:nq1oNFBKxRXiKfKu@wizardamxnxcluster.ovmio0y.mongodb.net/assignmentDB"
    ; // change if needed

const fixIndexes = async () => {
    try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

        console.log("Connected to MongoDB");

        // Drop the old emailId index if it exists
        await User.collection.dropIndex("emailId_1").catch(err => {
            if (err.codeName === "IndexNotFound") {
                console.log("Index emailId_1 not found, skipping.");
            } else {
                throw err;
            }
        });

        console.log("Dropped old index successfully");

        // Ensure new indexes (from schema) are applied
        await User.syncIndexes();

        console.log("Rebuilt indexes successfully");
    } catch (err) {
        console.error("Error fixing indexes:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    }
};

fixIndexes();
