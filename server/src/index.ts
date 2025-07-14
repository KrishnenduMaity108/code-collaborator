// server/src/index.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io'; // Renamed to avoid conflict with express.Server
import cors from 'cors';
import dotenv from 'dotenv';

// Import configurations
import { connectDB } from './config/database';
import './config/firebaseAdmin'; // Initialize Firebase Admin SDK

// Import middleware
import { authMiddleware } from './middleware/authMiddleware'; // Keep if you have general protected routes

// Import routes
import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';

// Import socket handlers
import { setupSocketHandlers } from './socket/socketHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO and Express
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// --- Register Express Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Basic Express route (can keep for health check)
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// --- Setup Socket.IO Handlers ---
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});