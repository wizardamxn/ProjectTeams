const express = require('express');
const authorised = require('../middlewares/authorised');
const Document = require('../models/documents');

const createDocRouter = express.Router();

createDocRouter.post('/create', authorised, async (req, res) => {
  try {
    const { title, content, summary, starred } = req.body;
    const { user } = req
    const createdBy = user._id
    const author = { name: user.fullName }
    const teamId = user.teamCode
    if (!title || !content || !createdBy || !teamId || !author) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const document = new Document({ title, content, createdBy, teamId, author, summary, starred });
    await document.save();

    res.status(201).json({ message: "Document Created Successfully", document });
  } catch (err) {
    console.error("Error creating document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

createDocRouter.get('/viewdocs', authorised, async (req, res) => {
  const { user } = req
  const { _id } = user
  const documents = await Document.find({ createdBy: _id })
  res.status(200).send(documents)
})

createDocRouter.get('/teamdocs', authorised, async (req, res) => {
  try {
    const { user } = req
    const teamCode = user.teamCode
    const documents = await Document.find({ teamId: teamCode })
    res.status(200).send(documents)
  }
  catch (err) {
    res.status(401).send("Something went wrong.")
  }
})

createDocRouter.get('/doc/:doc_id', authorised, async (req, res) => {
  try {
    const _id = req.params.doc_id;
    const doc = await Document.findById({ _id })
    res.send(doc)
  }
  catch (err) {
    res.send("Can't find Doc")
  }
})

createDocRouter.put('/edit/:doc_id', authorised, async (req, res) => {
  try {
    const _id = req.params.doc_id;
    const result = await Document.updateOne({ _id }, req.body);

    if (result.matchedCount === 0) {
      return res.status(404).send("Document not found");
    }

    const updatedDoc = await Document.findById(_id);
    res.send(updatedDoc);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating document");
  }
});

createDocRouter.put('/star/:doc_id', authorised, async (req, res) => {
  try {
    const _id = req.params.doc_id;

    // 1️⃣ Fetch the document first
    const doc = await Document.findById(_id);
    if (!doc) return res.status(404).send("Document not found");

    // 2️⃣ Toggle the starred value
    if (doc.starred === false) {
      doc.starred = true
    }
    else {
      doc.starred = false
    }

    // 3️⃣ Save the updated document
    await doc.save();

    // 4️⃣ Send back the updated doc
    res.send(doc);

  } catch (err) {
    console.error(err);
    res.status(500).send("Can't update the document");
  }
});

createDocRouter.get('/starred', authorised, async (req, res) => {
  try {
    const { user } = req
    const teamCode = user.teamCode
    const documents = await Document.find({ teamId: teamCode, starred: true })
    if(!documents){
      res.status(404).send("No documents available")
    }
    res.status(200).send(documents)
  
  }
  catch (err) {
    console.log(err)
    res.status(500).send("Something went wrong fetching starred docs")
  }
})

module.exports = createDocRouter;
