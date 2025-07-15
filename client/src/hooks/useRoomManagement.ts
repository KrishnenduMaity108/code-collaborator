// code-collaborator-ts-mongo/client/src/hooks/useRoomManagement.ts
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { type IRoom } from '../types';
import { Socket } from 'socket.io-client';
import { auth } from '../firebase';
import { type User as FirebaseSDKUser } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface UseRoomManagementResult {
    currentRoomId: string | null;
    roomData: IRoom | null;
    handleJoinRoom: (roomId: string, user: FirebaseSDKUser, socket: Socket) => Promise<void>;
    handleLeaveRoom: (socket: Socket) => void;
    setCurrentRoomId: React.Dispatch<React.SetStateAction<string | null>>;
    setRoomData: React.Dispatch<React.SetStateAction<IRoom | null>>;
}

export const useRoomManagement = (): UseRoomManagementResult => {
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [roomData, setRoomData] = useState<IRoom | null>(null);

    useEffect(() => {
        const storedRoomId = localStorage.getItem('lastVisitedRoomId');
        if (storedRoomId) {
            // Do NOT join here directly, as socket/user might not be ready.
            // Just set the currentRoomId, and let App.tsx's useEffect trigger join.
            setCurrentRoomId(storedRoomId);
        }
    }, []); // Run only once on mount

    const fetchRoomDetails = useCallback(async (roomId: string) => {
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                toast.error('Authentication token not found.');
                return null;
            }
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch room details.');
            }
            const data = await response.json();
            return data.room as IRoom; // Assuming server returns { room: IRoom }
        } catch (error: any) {
            console.error('Error fetching room details:', error);
            toast.error(error.message);
            return null;
        }
    }, []);

    const handleJoinRoom = useCallback(async (roomId: string, user: FirebaseSDKUser, socket: Socket) => {
        if (!socket || !user) {
            toast.error('Not connected or not logged in.');
            return;
        }

        try {
            const fetchedRoomData = await fetchRoomDetails(roomId);

            if (fetchedRoomData) {
                setRoomData(fetchedRoomData);
                setCurrentRoomId(roomId);
                localStorage.setItem('lastVisitedRoomId', roomId);

                socket.connect();
                socket.emit('joinRoom', { roomId, idToken: await user.getIdToken() }); // Ensure idToken is passed
                toast.success(`Joining room: ${fetchedRoomData.roomName}`);
            } else {
                setCurrentRoomId(null);
                setRoomData(null);
            }
        } catch (error) {
            console.error('Error in handleJoinRoom:', error);
            toast.error('Failed to join room: ' + (error as Error).message);
            setCurrentRoomId(null);
            setRoomData(null);
        }
    }, [fetchRoomDetails]);

    const handleLeaveRoom = useCallback((socket: Socket) => {
        if (socket && currentRoomId) {
            socket.disconnect(); // Disconnects from all Socket.IO rooms
            setCurrentRoomId(null);
            setRoomData(null);
            localStorage.removeItem('lastVisitedRoomId'); // Clear the ID
            toast('You left the room.');
        }
    }, [currentRoomId]);

    return {
        currentRoomId,
        roomData,
        handleJoinRoom,
        handleLeaveRoom,
        setCurrentRoomId,
        setRoomData,
    };
};