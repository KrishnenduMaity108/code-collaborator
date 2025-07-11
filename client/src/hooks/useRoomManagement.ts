// code-collaborator-ts-mongo/client/src/hooks/useRoomManagement.ts
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { type IFirebaseUser, type IRoom } from '../types';
import { Socket } from 'socket.io-client';
import { auth } from '../firebase';
import { type User as FirebaseSDKUser } from 'firebase/auth'; // Import the Firebase User type

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface UseRoomManagementResult {
    currentRoomId: string | null;
    roomData: IRoom | null;
    // Change the type of 'user' parameter here from IFirebaseUser to FirebaseSDKUser
    handleJoinRoom: (roomId: string, user: FirebaseSDKUser, socket: Socket) => Promise<void>;
    handleLeaveRoom: (socket: Socket) => void;
    setCurrentRoomId: React.Dispatch<React.SetStateAction<string | null>>;
    setRoomData: React.Dispatch<React.SetStateAction<IRoom | null>>;
}

export const useRoomManagement = (): UseRoomManagementResult => {
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [roomData, setRoomData] = useState<IRoom | null>(null);

    const fetchRoomDetails = useCallback(async (roomId: string) => {
        try {
            // auth.currentUser will return the FirebaseSDKUser type, which has getIdToken()
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
            return data.room as IRoom;
        } catch (error: any) {
            console.error('Error fetching room details:', error);
            toast.error(error.message);
            return null;
        }
    }, []);

    // Change the type of 'user' parameter here from IFirebaseUser to FirebaseSDKUser
    const handleJoinRoom = useCallback(async (roomId: string, user: FirebaseSDKUser, socket: Socket) => {
        if (!socket || !user) {
            toast.error('Not connected or not logged in.');
            return;
        }

        try {
            // The 'user' parameter here is now correctly typed as FirebaseSDKUser
            const idToken = await user.getIdToken();

            const fetchedRoomData = await fetchRoomDetails(roomId);

            if (fetchedRoomData) {
                setRoomData(fetchedRoomData);
                setCurrentRoomId(roomId);

                socket.connect();
                socket.emit('joinRoom', { roomId, idToken });
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
            socket.disconnect();
            setCurrentRoomId(null);
            setRoomData(null);
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