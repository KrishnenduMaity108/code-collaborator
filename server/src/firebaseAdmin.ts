import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if(!serviceAccountPath){
  console.error('FIREBASE_SERVICE_ACCOUNT_PATH is not set in environment variables.');
  process.exit(1);
}

const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully!');
} catch (error: any) {
  if (error.code === 'app/duplicate-app') {
    console.warn('Firebase Admin SDK already initialized.');
  } else {
    console.error('Error initializing Firebase Admin SDK:', error);
    process.exit(1);
  }
}

export const authAdmin = admin.auth();
