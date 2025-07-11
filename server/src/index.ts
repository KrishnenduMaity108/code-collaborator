import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import './firebaseAdmin';
import { authMiddleware } from './middleware/authMiddleware';
import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';
import User, {  IUser  } from './models/User';
import Room from './models/Room';
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

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

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

  socket.on('joinRoom', async ({ roomId, idToken }: { roomId: string; idToken: string }) => {
    try{
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const displayName = decodedToken.name || decodedToken.email;

      const mongoUser = await User.findOne({ firebaseUid }).lean();

      if(!mongoUser){
        socket.emit('roomJoinError', 'User not found in database.');
        return;
      }

      const room = await Room.findOne({ roomId });

      if(!room){
        socket.emit('roomJoinError', 'Room not found.');
        return;
      }

      const existingParticipant = room.participants.find(p => p.firebaseUid === firebaseUid);
      
      if(!existingParticipant){
        const userIdForParticipant = new mongoose.Types.ObjectId(mongoUser._id as mongoose.Types.ObjectId | string);

        room.participants.push({
          userId: userIdForParticipant,
          socketId: socket.id, 
          firebaseUid: firebaseUid,
          displayName: displayName || 'Anonymous'
        });
        await room.save();

      }else {
        existingParticipant.socketId = socket.id;
        await room.save();
      }

      socket.join(roomId);
      console.log(`${displayName} (${socket.id}) joined room: ${roomId}`);

      socket.emit('lodeCode', room.currentCode, room.language);

      const activeSocketIdsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const activeParticipantsData = activeSocketIdsInRoom
        .map(sId => {
          const s = io.sockets.sockets.get(sId);
          return s ? { socketId: s.id, displayName: s.data.displayName } : null; // Ensure data is present
        })
        .filter(data => data !== null) as { socketId: string; displayName: string }[];

      io.to(roomId).emit('participantJoined', {
        socketId: socket.id,
        firebaseUid,
        displayName: displayName || 'Anonymous'
      }, activeParticipantsData);

      socket.data = { 
        firebaseUid, 
        displayName, 
        roomId, 
        mongoUserId: mongoUser._id as mongoose.Types.ObjectId | string 
      }; 
      socket.emit('roomJoined', { 
        roomId,
        roomName: room.roomName,
        creatorName: room.creatorFirebaseUid 
      });

    }catch(error){
      console.error('Error joining room:', error);
      socket.emit('roomJoinError', 'Failed to join room: ' + (error as Error).message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if(socket.data.roomId){
      const roomId = socket.data.roomId;
      const displayName = socket.data.displayName || 'Anonymous';
      console.log(`${displayName} (${socket.id}) left room: ${roomId}`);

      const activeSocketIdsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

      const activeParticipantsData = activeSocketIdsInRoom
        .filter(sId => sId !== socket.id)
        .map(sId => {
          const s = io.sockets.sockets.get(sId);
          return s ? { socketId: s.id, displayName: s.data.displayName } : null;
        })
        .filter(data => data !== null) as { socketId: string; displayName: string }[];

      io.to(roomId).emit('participantLeft', {
        socketId: socket.id,
        displayName: displayName
      }, activeParticipantsData);
    }
  });


  socket.on('codeChange', async ({ roomId, newCode }: { roomId: string; newCode: string }) => {
    const room = await Room.findOne({ roomId });
    if(room){
      room.currentCode = newCode;
      await room?.save();
      socket.to(roomId).emit('codeUpdate', newCode);
    }
  });

  socket.on('languageChange', async ({ roomId, newLanguage }: { roomId: string; newLanguage: string }) => {
    const room = await Room.findOne({ roomId });
    if (room) {
      room.language = newLanguage;
      await room.save();
      socket.to(roomId).emit('languageUpdate', newLanguage);
    }
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