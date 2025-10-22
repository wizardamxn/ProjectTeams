const express = require('express');
const app = express();
const connectDB = require('./database/database')
const cookieparser = require('cookie-parser');
const authRouter = require('./Routes/auth');
const cors = require("cors");
const createDocRouter = require('./Routes/doc');
const profileRouter = require('./Routes/profile')
const aiRouter = require('./Routes/ai')
const http = require('http');
const initializeSocket = require('./utils/socket');


app.use(cookieparser())
app.use(cors({
  origin: true,
  credentials:true
}));
app.use(express.json())

const server = http.createServer(app)
initializeSocket(server)

app.use("/", authRouter);
app.use("/", createDocRouter);
app.use("/", profileRouter);
app.use("/", aiRouter);



connectDB().then(() => {

    server.listen(2222, () => {
        console.log("started the server")
    })
    // app.listen(2222, () => {
    //     console.log("started the server")
    // })
})