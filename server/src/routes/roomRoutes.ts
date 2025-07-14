import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import Room from "../models/Room";
import User from "../models/User";
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import * as express from 'express';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
  app: express.Application;
}

// --- POST /create ---
router.post('/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser) {
      res.status(401).json({ message: 'Unauthorized: No Firebase user.' });
      return;
    }

    const { roomName, language } = req.body;

    if (!roomName) {
      res.status(400).json({ message: 'Room name is required.' });
      return;
    }

    const mongoUser = await User.findOne({ firebaseUid: firebaseUser.uid });

    if (!mongoUser) {
      res.status(404).json({ message: 'User not found in database.' });
      return;
    }

    // Generate a unique roomId using uuid
    const newRoomId = uuidv4(); // Generate full UUID
    // You can optionally shorten it if you prefer: const newRoomId = uuidv4().substring(0, 8);

    const newRoom = new Room({
      roomId: newRoomId, // Use the generated UUID
      roomName,
      creatorId: mongoUser._id,
      creatorFirebaseUid: firebaseUser.uid,
      language: language || 'javascript',
      currentCode: '// Start coding in ' + (language || 'javascript') + '...',
      participants: [],
    })

    await newRoom.save();

    res.status(201).json({ message: 'Room created successfully', room: newRoom.toObject() });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Failed to create room', error: (error as Error).message });
  }
});

// --- GET /my-rooms ---
router.get('/my-rooms', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser) {
      res.status(401).json({ message: 'Unauthorized: No Firebase user.' });
      return;
    }

    const mongoUser = await User.findOne({ firebaseUid: firebaseUser.uid });
    if (!mongoUser) {
      res.status(404).json({ message: 'User not found in database.' });
      return;
    }

    const rooms = await Room.find({ creatorId: mongoUser._id }).lean();
    res.status(200).json({ rooms });

  } catch (error) {
    console.error('Error fetching my rooms:', error);
    res.status(500).json({ message: 'Failed to fetch rooms', error: (error as Error).message });
  }
});

// --- GET /:roomId ---
router.get('/:roomId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId }).lean();

    if (!room) {
      res.status(404).json({ message: 'Room not found.' });
      return;
    }
    res.status(200).json({ room });

  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ message: 'Failed to fetch room', error: (error as Error).message });
  }
});

// --- NEW: DELETE /:roomId ---
router.delete('/:roomId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const firebaseUid = req.user?.uid;

    if (!firebaseUid) {
      res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
      return;
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      res.status(404).json({ message: 'Room not found.' });
      return;
    }

    if (room.creatorFirebaseUid !== firebaseUid) {
      res.status(403).json({ message: 'Forbidden: Only the room creator can delete this room.' });
      return;
    }

    await Room.deleteOne({ roomId });
    console.log(`Room ${roomId} deleted by ${firebaseUid}`);

    // Retrieve the Socket.IO instance
    const io: SocketIOServer = req.app.get('io');
    if (io) {
      io.to(roomId).emit('roomDeleted', { roomId });
      console.log(`Emitted 'roomDeleted' for room ${roomId}`);
    } else {
      console.warn('Socket.IO instance not found on app. This should not happen if app.set("io", io) is called correctly.');
    }

    res.status(200).json({ message: 'Room deleted successfully.' });

  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Server error during room deletion.', error: (error as Error).message });
  }
});

export default router;