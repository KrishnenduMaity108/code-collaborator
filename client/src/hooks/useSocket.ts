// client/src/hooks/useSocket.ts
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { type IActiveParticipant } from '../types'; // Import IActiveParticipant

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Extend Socket type to include custom data property
interface CustomSocket extends Socket {
    data?: {
        firebaseUid: string;
        displayName: string;
        roomId: string;
        mongoUserId: string; // Or mongoose.Types.ObjectId if you prefer
    };
}

interface UseSocketResult {
    socket: CustomSocket | null;
    activeParticipants: IActiveParticipant[]; // New state for active participants
}

export const useSocket = (): UseSocketResult => {
    const [socket, setSocket] = useState<CustomSocket | null>(null);
    const socketRef = useRef<CustomSocket | null>(null);
    const [activeParticipants, setActiveParticipants] = useState<IActiveParticipant[]>([]);

    useEffect(() => {
        const newSocket: CustomSocket = io(SOCKET_SERVER_URL, {
            autoConnect: false, // Don't connect automatically
        });
        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server!');
            toast.success('Connected to server!');
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO server!');
            toast.error('Disconnected from server!');
            setActiveParticipants([]); // Clear participants on disconnect
        });

        newSocket.on('roomJoinError', (message: string) => {
            toast.error(`Error joining room: ${message}`);
            setActiveParticipants([]); // Clear participants on join error
        });

        newSocket.on('participantJoined', (participant: IActiveParticipant, currentParticipants: IActiveParticipant[]) => {
            toast(`👋 ${participant.displayName} joined the room!`);
            setActiveParticipants(currentParticipants);
        });

        newSocket.on('participantLeft', (participant: IActiveParticipant, currentParticipants: IActiveParticipant[]) => {
            toast(`🚶 ${participant.displayName} left the room.`);
            setActiveParticipants(currentParticipants);
        });


        return () => {
            newSocket.disconnect();
        };
    }, []);

    return { socket, activeParticipants };
};