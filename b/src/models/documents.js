import mongoose from "mongoose";


const authorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String },

}, { _id: false } // ✅ prevents automatic subdocument _id
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxLength: 100 },
    content: { type: String, required: true, maxLength: 5000 },
    summary: { type: String },
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    teamId: { type: String, required: true },
    author: { type: authorSchema, required: true },
    starred: {type: Boolean, default:false},
    versions: [
      {
        content: String,
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Document = mongoose.model("Document", documentSchema)
export default Document
