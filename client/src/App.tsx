import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import toast, { Toaster } from "react-hot-toast";
import Auth from "./components/Auth"
import { auth } from "./firebase";
import RoomLobby from "./components/RoomLobby";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mongoUser, setMongoUser] = useState<any>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const newSocket: Socket = io(SOCKET_SERVER_URL, {
      autoConnect: false,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Socket>IO server!');
      toast.success('Connected to Server!');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server!');
      toast.error('Disconnected from server!');
      setCurrentRoomId(null);
      setRoomData(null);
    });

    newSocket.on('roomJoined', (data: any) => {
      toast.success(`Joined room: ${data.roomName} (ID: ${data.roomId})`);
      setRoomData(data);
    })

    newSocket.on('loadCode', (code: string, language: string) => {
      console.log('Loaded initial code:', code);
    })

    newSocket.on('participantJoined', (participant: any, activeParticipants: string[]) => {
      toast(`👋 ${participant.displayName} joined the room!`);
      console.log('Active participants:', activeParticipants);
      // Update participant list in UI
    });

    newSocket.on('participantLeft', (participant: any, activeParticipants: string[]) => {
      toast(`🚶 ${participant.displayName} left the room.`);
      console.log('Active participants:', activeParticipants);
      // Update participant list in UI
    });

    return () => {
      newSocket.disconnect();
    };

  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        console.log('User is signed in (Firebase):', authUser.uid, authUser.email);
        setUser(authUser);

        try {
          const idToken = await authUser.getIdToken();
          console.log('Firebase ID Token:', idToken);

          const response = await fetch(`${API_BASE_URL}/api/auth/sync-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          setMongoUser(data.user);
          toast.success('User data synced with MongoDB!');
          console.log('User synced with MongoDB:', data.user);

        } catch (error) {
          console.error('Error syncing user with backend:', error);
          toast.error('Failed to sync user data with MongoDB.');
          signOut(auth);
        }
      } else {
        console.log('User is signed out');
        setUser(null);
        setMongoUser(null);
        setCurrentRoomId(null);
        setRoomData(null);
        socketRef.current?.disconnect();
      }
    });

    return () => unsubscribe();

  }, [])

  const handleJoinRoom = async (roomId: string) => {
    if (!socket || !user) {
      toast.error('Not connected or not logged in.');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      setCurrentRoomId(roomId); // Set room ID immediately for UI
      socket.connect(); // Ensure socket is connected
      socket.emit('joinRoom', { roomId, idToken }); // Emit joinRoom event
    } catch (error) {
      console.error('Error getting ID token for joining room:', error);
      toast.error('Failed to get authentication token to join room.');
      setCurrentRoomId(null);
    }
  }

  const handleLeaveRoom = () => {
    if (socket && currentRoomId) {
      socket.emit('leaveRoom', { roomId: currentRoomId }); // Will add leaveRoom event on server later
      socket.disconnect(); // Simpler for now, disconnects completely
      setCurrentRoomId(null);
      setRoomData(null);
      toast('You left the room.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully!');
    } catch (error: any) {
      console.error('Error logging out:', error.message);
      toast.error('Failed to log out.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="flex justify-between items-center p-4 bg-gray-800 shadow-md">
        <h1 className="text-2xl font-bold text-cyan-400">Code Collaborator</h1>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-lg">Hello, {user.displayName || user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main>
        {!user ? (
          <Auth />
        ) : currentRoomId ? (
          // This will eventually be your CodeEditor component
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              In Room: {roomData?.roomName} (ID: {currentRoomId})
            </h2>
            <p className="text-gray-400 mb-6">You are connected! Collaborative editor will go here.</p>
            <button
              onClick={handleLeaveRoom}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Leave Room
            </button>
            {/* Temporary Socket.IO test */}
            <div className="mt-8">
              <input
                type="text"
                value={''} // Remove message state as it's not relevant here
                onChange={() => { }}
                placeholder="Type a message to server..."
                className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 mr-2"
                disabled // Disable for now
              />
              <button
                onClick={() => { }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors"
                disabled // Disable for now
              >
                Send Test Message
              </button>
            </div>
          </div>
        ) : (
          <RoomLobby onJoinRoom={handleJoinRoom} userId={user.uid} />
        )}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;