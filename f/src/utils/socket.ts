import { io } from "socket.io-client";


// Prod: VITE_SOCKET_URL is empty -> undefined -> socket.io connects to the
// page origin (nginx proxies /socket.io to the backend).
// Dev: VITE_SOCKET_URL points at the backend, e.g. http://localhost:2222.
const socketURL = import.meta.env.VITE_SOCKET_URL || undefined;


const socket = io(socketURL, {
    withCredentials: true,
    transports: ["websocket"],
    autoConnect: true,
});

export default socket;
