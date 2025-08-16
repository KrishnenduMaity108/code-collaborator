# 💻 Live Code Collaborator

A real-time, multi-language code editor that enables seamless collaboration among developers.  
Built as a full-stack application, it features **instant code synchronization**, **integrated code execution via a secure Docker-based runtime**, and a **robust user management system**.

<img width="1920" height="1080" alt="Screenshot 2025-08-16 181102" src="https://github.com/user-attachments/assets/541fac45-2bca-43ab-b8d3-c9be81d47077" />

---

## ✨ Features

- **Real-time Code Synchronization**  
  Collaborate in the same room with instant code updates. Changes are reflected for all participants in real-time.

- **Secure Code Execution**  
  Run your code directly from the browser inside an isolated Docker container.  
  Supports **JavaScript, Python, Java, C++, C, and more**.

- **User Authentication**  
  Secure sign-up and login using **Email/Password, Google, and GitHub**.

- **Room Management**  
  Create private rooms, join by room ID, and manage your rooms with options:  
  _Open_, _Copy ID_, and _Delete_.

- **Code Persistence**  
  Code and language state are automatically saved and restored from **MongoDB**.

- **Dynamic Language & Cursor Control**  
  Switch between programming languages easily.  
  Toggle visibility of other users' cursors and selections for a cleaner experience.

---

## 🛠️ Technologies Used

### Frontend
- **React & TypeScript** – Core of the UI  
- **CodeMirror 6** – Extensible code editor with real-time collaboration features  
- **Socket.IO Client** – Real-time communication  
- **Firebase Authentication** – Secure user auth  
- **Tailwind CSS** – Utility-first styling  

### Backend
- **Node.js & Express.js** – API and server logic  
- **TypeScript** – Type-safe backend  
- **Socket.IO Server** – Manages WebSocket connections  
- **MongoDB & Mongoose** – Database for users, rooms, and code  
- **Firebase Admin SDK** – Backend identity verification  
- **Docker** – Isolated, secure runtime for executing code  

---

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites
- [Node.js & npm](https://nodejs.org/) (or Yarn)  
- [Docker](https://www.docker.com/) (Desktop for Windows/macOS, Engine for Linux)  
- [MongoDB](https://www.mongodb.com/) (local or [MongoDB Atlas](https://www.mongodb.com/atlas))  
- [Firebase Project](https://firebase.google.com/) with Authentication enabled  
- [Git](https://git-scm.com/)  

---

### Installation

#### 1. Clone the repository

git clone [https://github.com/your-username/your-repo-name.git
cd your-repo-name](https://github.com/KrishnenduMaity108/code-collaborator.git)


#### 2. Set up Environment Variables

Server (server/.env)

PORT=3001
MONGO_URI="mongodb://localhost:27017/code_collaborator_db"
FIREBASE_SERVICE_ACCOUNT_PATH="<path/to/your/serviceAccountKey.json>"
CLIENT_URL="http://localhost:5173"


Client (client/.env)

VITE_SERVER_URL="http://localhost:3001"
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."

#### 3. Install Dependencies

Server: -
cd server
npm install


Client: -
cd ../client
npm install

#### 4. Build Docker Images (for code execution)

From the server directory:

docker build -f ./dockerfiles/Dockerfile.javascript -t code-runner-javascript:latest .
docker build -f ./dockerfiles/Dockerfile.python -t code-runner-python:latest .
docker build -f ./dockerfiles/Dockerfile.java -t code-runner-java:latest .
docker build -f ./dockerfiles/Dockerfile.cpp -t code-runner-cpp:latest .
# Repeat for C and any other supported languages


⚠️ Troubleshooting Tip:
If you encounter a "cannot find module" error when running code inside Docker, check your file paths.
Ensure the container uses forward slashes (/) instead of Windows-style backslashes (\).

▶️ Running the Project

Start the server and client in separate terminals.

Start the Server

cd server
npm run dev


Start the Client

cd client
npm run dev


Now open:
👉 http://localhost:5173

<img width="1078" height="1018" alt="Screenshot 2025-08-16 174753" src="https://github.com/user-attachments/assets/d42910c1-f0a3-4de9-86d1-5802620b74a8" />

---
<img width="1259" height="1192" alt="FireShot Capture 001 - code collaborator -  localhost" src="https://github.com/user-attachments/assets/70e4ef69-e1b3-4e18-bbb9-c1f58e61afaa" />

---
<img width="959" height="1483" alt="FireShot Capture 003 - code collaborator -  localhost" src="https://github.com/user-attachments/assets/5c68c184-d1a6-48ea-a3ac-869b59d0cf8c" />

---
<img width="1920" height="1080" alt="Screenshot 2025-08-16 181102" src="https://github.com/user-attachments/assets/480cc4f0-e4a6-4837-903c-d0c5340c4e9e" />


### 📌 Future Improvements

- Add syntax error detection with inline hints
- Extend support for collaborative debugging
- Implement role-based access control for rooms

## Built with ❤️ by Krishnendu Maity

Would you like me to also include **example `.env` template files** (`.env.example`) for both `server` and `client` so new contributors can copy them directly instead of writing from scratch?
```bash
