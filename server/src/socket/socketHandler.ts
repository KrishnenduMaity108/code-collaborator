// server/src/socket/socketHandler.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as admin from 'firebase-admin';
import Room from '../models/Room';
import User from '../models/User';
import mongoose from 'mongoose'; // For ObjectId

// This function will set up all Socket.IO event listeners
export const setupSocketHandlers = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Room Joining Logic ---
    socket.on('joinRoom', async ({ roomId, idToken }: { roomId: string; idToken: string }) => {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;
        const displayName = decodedToken.name || decodedToken.email;

        const mongoUser = await User.findOne({ firebaseUid }).lean();

        if (!mongoUser) {
          socket.emit('roomJoinError', 'User not found in database.');
          return;
        }

        const room = await Room.findOne({ roomId });

        if (!room) {
          socket.emit('roomJoinError', 'Room not found.');
          return;
        }

        const existingParticipant = room.participants.find(p => p.firebaseUid === firebaseUid);

        if (!existingParticipant) {
          const userIdForParticipant = new mongoose.Types.ObjectId(mongoUser._id as mongoose.Types.ObjectId | string);
          room.participants.push({
            userId: userIdForParticipant,
            socketId: socket.id,
            firebaseUid: firebaseUid,
            displayName: displayName || 'Anonymous'
          });
          await room.save();
        } else {
          // Update socketId for existing participant if they reconnected
          existingParticipant.socketId = socket.id;
          await room.save();
        }

        socket.join(roomId);
        console.log(`${displayName} (${socket.id}) joined room: ${roomId}`);

        // Emit current code to the newly joined user
        socket.emit('loadCode', room.currentCode, room.language);

        // Set user data on the socket instance for easier access later
        socket.data = { firebaseUid, displayName, roomId, mongoUserId: mongoUser._id as mongoose.Types.ObjectId | string };

        // Get active participants and their display names for the room
        const activeSocketIdsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const activeParticipantsData = activeSocketIdsInRoom
          .map(sId => {
            const s = io.sockets.sockets.get(sId);
            return s ? { socketId: s.id, displayName: s.data.displayName } : null;
          })
          .filter(data => data !== null) as { socketId: string; displayName: string }[];

        io.to(roomId).emit('participantJoined', {
          socketId: socket.id,
          firebaseUid,
          displayName: displayName || 'Anonymous'
        }, activeParticipantsData);

        socket.emit('roomJoined', { roomId, roomName: room.roomName, creatorName: room.creatorFirebaseUid });

      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('roomJoinError', 'Failed to join room: ' + (error as Error).message);
      }
    });

    // --- Disconnect Logic ---
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.data.roomId) {
        const roomId = socket.data.roomId;
        const displayName = socket.data.displayName || 'Anonymous';
        console.log(`${displayName} (${socket.id}) left room: ${roomId}`);

        // Optional: Update participant list in DB if needed (e.g., remove from active list)
        // For now, we rely on Socket.IO's internal room tracking for active users.

        // Get updated list of active participants
        const activeSocketIdsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const activeParticipantsData = activeSocketIdsInRoom
          .filter(sId => sId !== socket.id) // Filter out the disconnected user
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

    // --- Code Synchronization (from previous step, now in socketHandler) ---
    socket.on('codeChange', async ({ roomId, newCode }: { roomId: string; newCode: string }) => {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.currentCode = newCode;
        await room.save();
        socket.to(roomId).emit('codeUpdate', newCode);
      }
    });

    // Language change (from previous step, now in socketHandler)
    socket.on('languageChange', async ({ roomId, newLanguage }: { roomId: string; newLanguage: string }) => {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.language = newLanguage;
        await room.save();
        socket.to(roomId).emit('languageUpdate', newLanguage);
      }
    });

    // Add a simple test event (from initial setup)
    socket.on('helloFromClient', (message: string) => {
      console.log('Message from client:', message);
      socket.emit('helloFromServer', `Server received: ${message}`);
    });

  });
};