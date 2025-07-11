// server/src/config/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
    console.error('FIREBASE_SERVICE_ACCOUNT_PATH is not set in environment variables.');
    // process.exit(1); // Don't exit here, let main index.ts handle it
}

try {
    // Only initialize if not already initialized
    if (!admin.apps.length) {
        const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath!)); // Use ! for non-null assertion
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully!');
    } else {
        console.warn('Firebase Admin SDK already initialized.');
    }
} catch (error: any) {
    console.error('Error initializing Firebase Admin SDK:', error);
    // process.exit(1); // Don't exit here, let main index.ts handle it
}

export const authAdmin = admin.auth();
// Export other admin services if needed, e.g., export const firestoreAdmin = admin.firestore();