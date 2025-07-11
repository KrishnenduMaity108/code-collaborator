// client/src/types/index.ts

// Define the structure of a Firebase User (simplified for common properties)
export interface IFirebaseUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    // Add other Firebase User properties you might need
}

// Define the structure of a MongoDB User
export interface IMongoUser {
    _id: string; // MongoDB ObjectId as a string
    firebaseUid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    createdAt: string; // Date as string
    updatedAt: string; // Date as string
}

// Define the structure of a Room
export interface IRoom {
    _id: string; // MongoDB ObjectId as a string
    roomId: string; // Short, human-readable room ID
    roomName: string;
    creatorId: string; // MongoDB ObjectId of the creator as a string
    creatorFirebaseUid: string;
    currentCode: string;
    language: string;
    participants: {
        userId: string; // MongoDB ObjectId of participant as a string
        socketId: string;
        firebaseUid: string;
        displayName: string;
    }[];
    createdAt: string;
    updatedAt: string;
}

// Define the structure for active participants in a room (for Socket.IO events)
export interface IActiveParticipant {
    socketId: string;
    displayName: string;
    // Add other relevant participant data if needed
}