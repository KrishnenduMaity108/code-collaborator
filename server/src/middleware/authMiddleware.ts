import { Request, Response, NextFunction } from "express";
import * as admin from 'firebase-admin';
import { authAdmin } from "../config/firebaseAdmin";

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized: No token provided or invalid format.');
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  }
  catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized: Invalid or expired token.');
  }

};