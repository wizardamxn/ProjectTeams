# 🧠 Project Teams

A real-time collaboration platform where teams can chat, share ideas, and work together seamlessly. Think of it as your own lightweight Notion meets Slack — built to help teams stay connected and productive.

> 🚧 **Heads up:** This is still a work in progress! Core features are working, but I'm actively improving document syncing and ironing out some WebRTC quirks.

---

## 🛠️ Built With

| **Frontend** | React, Redux, Tailwind CSS, Socket.IO Client |
| **Backend** | Node.js, Express, Socket.IO, Mongoose |
| **Database** | MongoDB |
| **Real-time Magic** | WebSockets (Socket.IO), WebRTC |
| **Dev Tools** | TypeScript, Vite, ESLint |

---

## ✨ What It Does

Right now, the app lets you:

- 💬 **Chat in real-time** — instant messaging across team rooms
- 📄 **Edit documents together** — collaborative editing with live updates
- 🟢 **See who's around** — presence indicators show who's online
- 🔄 **Version history** (coming soon) — never lose track of changes
- 🎥 **Video rooms** (in the works) — peer-to-peer calls using WebRTC
- 🔐 **Secure sharing** (planned) — role-based access control for docs


## 📂 How It's Organized

    projectteamsfinal/
    ├── frontend/
    │   ├── src/
    │   │   ├── components/      # React components
    │   │   ├── hooks/           # Custom hooks
    │   │   ├── pages/           # Main pages
    │   │   ├── store/           # Redux state
    │   │   ├── utils/           # Helper functions
    │   │   ├── App.tsx
    │   │   └── main.tsx
    │   ├── public/
    │   ├── package.json
    │   └── vite.config.ts
    │
    └── backend/
        ├── database/            # Schemas & migrations
        ├── middlewares/         # Auth, validation, etc.
        ├── models/              # Mongoose models
        ├── Routes/              # API endpoints
        ├── utils/
        ├── app.js
        └── package.json


## 🚀 Getting Started

### Clone it
git clone https://github.com/wizardamxn/project-teams.git
cd project-teams

text

### Install everything
Backend
cd backend
npm install

Frontend (in a new terminal)
cd frontend
npm install

text

### Set up your `.env` files
Create `.env` in both `backend/` and `frontend/` with your MongoDB URI, API keys, etc.

### Run it locally
Start the backend
cd backend
npm run dev

Start the frontend (new terminal)
cd frontend
npm run dev

text

Now open [http://localhost:5173](http://localhost:5173) and you're good to go.

---

## 🎯 What I'm Working On

- Making document sync more reliable
- Adding user authentication (JWT-based)
- Getting WebRTC video calls production-ready
- Building out a proper permissions system

---

## 🤝 Want to Contribute?

Feel free to open an issue or shoot me a pull request if you spot something broken or have ideas to improve things. All feedback is welcome!

---

## 📜 License

MIT License — feel free to use this however you want.

---

## 👤 Made By

**Aman Ahmad**  
🌐 [Portfolio](https://amanahmad.vercel.app/)  
🐙 [GitHub](https://github.com/wizardamxn)
