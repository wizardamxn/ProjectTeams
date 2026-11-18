import { io } from "socket.io-client";


// Prod: VITE_SOCKET_URL is empty -> undefined -> socket.io connects to the
// page origin (nginx proxies /socket.io to the backend).
// Dev: VITE_SOCKET_URL points at the backend, e.g. http://localhost:2222.
const socketURL = import.meta.env.VITE_SOCKET_URL || undefined;


const socket = io(socketURL, {
    withCredentials: true,
    transports: ["websocket"],
    // Connect only after login: the server rejects sockets without an auth cookie.
    autoConnect: false,
});

export default socket;
