import { Router, Request, Response } from "express";
import { authAdmin } from "../firebaseAdmin";
import * as admin from 'firebase-admin';
import User from "../models/User";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

router.post('/sync-user', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try{
    const firebaseUser = req.user;

    if(!firebaseUser){
      res.status(401).json({ message: 'Unauthorized: Firebase user not found in token.'});
      return;
    }

    const { uid, email, displayName, photoURL } = firebaseUser;

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        email,
        displayName: displayName || email,
        photoURL,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean();
    res.status(200).json({ message: 'User synced successfully', user });
  }
  catch(error) {
    console.error('Error syncing user with MongoDB:', error);
    res.status(500).json({ message: 'Failed to sync user', error });
  }
})


router.get('/user-profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser) {
      res.status(401).json({ message: 'Unauthorized: Firebase user not found in token.' });
      return;
    }

    // Fetch the user's full profile from MongoDB
    const userProfile = await User.findOne({ firebaseUid: firebaseUser.uid }).lean();

    if (!userProfile) {
      res.status(404).json({ message: 'User profile not found in database.' });
      return;
    }

    res.status(200).json({ user: userProfile });
  } 
  catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile', error });
  }
});

export default router;