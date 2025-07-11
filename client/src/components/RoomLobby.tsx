// client/src/components/RoomLobby.tsx
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { type IRoom } from '../types'; // Import IRoom type

interface RoomLobbyProps {
  onJoinRoom: (roomId: string) => void;
  userId: string; // Firebase UID
}

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const RoomLobby: React.FC<RoomLobbyProps> = ({ onJoinRoom, userId }) => {
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myRooms, setMyRooms] = useState<IRoom[]>([]); // Use IRoom type
  const [isLoading, setIsLoading] = useState(false);

  // Fetch rooms created by the user
  useEffect(() => {
    const fetchMyRooms = async () => {
      setIsLoading(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          toast.error('Authentication token not found.');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/rooms/my-rooms`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setMyRooms(data.rooms);
      } catch (error) {
        console.error('Error fetching my rooms:', error);
        toast.error('Failed to load your rooms.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) { // Only fetch if userId is available
      fetchMyRooms();
    }
  }, [userId]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Room name cannot be empty.');
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error('Authentication token not found.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ roomName: newRoomName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create room.');
      }

      const data = await response.json();
      toast.success(`Room "${data.room.roomName}" created with ID: ${data.room.roomId}`);
      setNewRoomName('');
      onJoinRoom(data.room.roomId); // Automatically join the new room
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-8 text-cyan-400">Collaborative Rooms</h1>

      {/* Create Room Section */}
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">Create New Room</h2>
        <input
          type="text"
          placeholder="Enter Room Name"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreateRoom}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating...' : 'Create Room'}
        </button>
      </div>

      {/* Join Room Section */}
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">Join Existing Room</h2>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={joinRoomId}
          onChange={(e) => setJoinRoomId(e.target.value)}
          className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            if (joinRoomId.trim()) {
              onJoinRoom(joinRoomId.trim());
            } else {
              toast.error('Please enter a Room ID.');
            }
          }}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join Room
        </button>
      </div>

      {/* My Rooms Section */}
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">My Rooms</h2>
        {isLoading && myRooms.length === 0 ? (
          <p className="text-center text-gray-400">Loading your rooms...</p>
        ) : myRooms.length === 0 ? (
          <p className="text-center text-gray-400">You haven't created any rooms yet.</p>
        ) : (
          <ul className="space-y-3">
            {myRooms.map((room) => (
              <li key={room.roomId} className="flex items-center justify-between bg-gray-700 p-3 rounded-md border border-gray-600">
                <span>
                  <p className="font-semibold text-lg">{room.roomName}</p>
                  <p className="text-sm text-gray-400">ID: {room.roomId}</p>
                </span>
                <button
                  onClick={() => onJoinRoom(room.roomId)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-1 px-3 rounded transition-colors"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;