const socket = require("socket.io")


const initializeSocket = (server) => {
    const io = socket(server, {
        cors: {
            origin: true,
        }
    })
    io.on('connection', (socket) => {
        socket.on('joinChat', ({ userId, targetUserId }) => {
            const roomId = [userId, targetUserId].sort().join('_');
            console.log(roomId)
            socket.join(roomId)

        })
        socket.on('sendMessage', ({ fullName, userId, targetUserId, message }) => {
            const roomId = [userId, targetUserId].sort().join('_');
            console.log(fullName + " : " + message)
            io.to(roomId).emit("messageReceived", { fullName, message })
        })
        socket.on('disconnect', () => { })
    })
}
module.exports = initializeSocket