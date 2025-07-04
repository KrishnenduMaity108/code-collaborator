import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import './firebaseAdmin';
import { authMiddleware } from './middleware/authMiddleware';
import * as admin from 'firebase-admin';

dotenv.config();   // Load environment variables

const app = express();
const server = http.createServer(app);

interface AuthenticatedRequest extends express.Request {
  user?: admin.auth.DecodedIdToken;
}

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173", // React app's URL
    methods: ["GET", "POST"]
  }
})

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/code_collaborator';
mongoose.connect(MONGODB_URI)
  .then(()=>console.log("MongDB connected successfully!"))
  .catch(err => {
    console.error("Mongodb connection error", err);
    process.exit(1);
  });

app.get('/', (req,res) => {
  console.log("hello");
  res.send('Hello');
});

app.get('/protected', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'You accessed a protected route!',
    userId: req.user?.uid,
    email: req.user?.email
  });
});

io.on('connection', (socket : Socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('helloFromClient', (message : string) => {
    console.log(`Message from client:`, message);
    socket.emit('helloFromServer', `Server received: ${message}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>{
  console.log(`Server is lintning on port no ${PORT}`);
})