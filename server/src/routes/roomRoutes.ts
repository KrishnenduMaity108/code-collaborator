import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import Room from "../models/Room";
import User from "../models/User";
import * as admin from 'firebase-admin';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

router.post('/create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUser = req.user;
    if(!firebaseUser){
      res.status(401).json({ message: 'Unauthorized: No Firebase user.' });
      return;
    }

    const { roomName, language } = req.body;
    
    if (!roomName) {
      res.status(400).json({ message: 'Room name is required.' });
      return;
    }

    const mongoUser = await User.findOne({ firebaseUid: firebaseUser.uid });

    if(!mongoUser){
      res.status(404).json({ message: 'User not found in database.' });
      return;
    }

    const newRoom = new Room({
      roomName,
      creatorId: mongoUser._id,
      creatorFirebaseUid: firebaseUser.uid,
      language: language || 'javascript',
      currentCode:  '// Start coding in ' + (language || 'javascript') + '...',
    })

    await newRoom.save();

    res.status(201).json({ message: 'Room created successfully', room: newRoom.toObject() });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Failed to create room', error: (error as Error).message });
  }
});

router.get('/my-rooms', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser) {
      res.status(401).json({ message: 'Unauthorized: No Firebase user.' });
      return ;
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

router.get('/:roomId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try{
    const { roomId } = req.params;
    const room = await Room.findOne({roomId}).lean();

    if(!room){
      res.status(404).json({ message: 'Room not found.' });
      return;
    }
    res.status(200).json({ room });

  }catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ message: 'Failed to fetch room', error: (error as Error).message });
  }
});

export default router;