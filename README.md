---

# 🧠 Project Teams

> A real-time collaboration platform where teams can chat, share ideas, and co-edit documents — built with React, Node.js, and WebSockets.
> Think **Notion + Slack**, handcrafted for seamless teamwork.

---

## ✨ Features

* 💬 **Live Chat** — instant team messaging via Socket.IO
* 📄 **Collaborative Editing** — co-editing documents with live updates
* 🟢 **Presence Indicators** — see who’s online in real time
* 🔄 **Version History** (coming soon)
* 🎥 **Video Rooms** (in progress, WebRTC-based)
* 🔐 **Secure Sharing** (planned, role-based access)

---

## 🛠️ Built With

| Layer                | Technologies                                             |
| :------------------- | :------------------------------------------------------- |
| **Frontend**         | React, Redux, Tailwind CSS, TypeScript, Socket.IO Client |
| **Backend**          | Node.js, Express, Socket.IO, Mongoose                    |
| **Database**         | MongoDB                                                  |
| **Real-Time Engine** | WebSockets (Socket.IO), WebRTC                           |
| **Dev Tools**        | Vite, ESLint, Vercel AI SDK                              |

---

## 📂 Project Structure

```
projectteamsfinal/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
└── backend/
    ├── database/
    ├── middlewares/
    ├── models/
    ├── Routes/
    ├── utils/
    ├── app.js
    └── package.json
```

---

## ⚙️ Setup & Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/wizardamxn/project-teams.git
cd project-teams
```

---

### 2️⃣ Backend setup

```bash
cd backend
npm install
```

Create a file named `.env` in the **backend** folder and add:

```bash
PORT=2222
MONGODB_URI=your_mongodb_uri_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_gemini_api_key
```

Run the backend:

```bash
npm run dev
```

---

### 3️⃣ Frontend setup

```bash
cd frontend
npm install
```

Create a file named `.env` in the **frontend** folder and add:

```bash
VITE_BACKEND_URL=http://localhost:2222
```

Run the frontend:

```bash
npm run dev
```

Now open 👉 [http://localhost:5173](http://localhost:5173)

---

## 🧭 Roadmap

* ✅ Real-time chat
* ✅ Collaborative docs
* 🛠️ Improved document syncing
* 🔐 JWT authentication
* 📹 WebRTC video rooms
* 🧱 Role-based permissions

---

## 🤝 Contributing

Contributions are welcome!
If you find a bug or want to add a feature, open an issue or submit a pull request.

---

## 📜 License

MIT License — free for personal and commercial use.

---

## 👤 Author

**Aman Ahmad**
🌐 [Portfolio](https://amanahmad.vercel.app)
🐙 [GitHub](https://github.com/wizardamxn)

---
