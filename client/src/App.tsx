// code-collaborator-ts-mongo/client/src/App.tsx
import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Auth from './components/Auth';
import RoomLobby from './components/RoomLobby';
import Header from './components/Header';

import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useRoomManagement } from './hooks/useRoomManagement';
import { type IActiveParticipant, type IFirebaseUser } from './types'; // Import IFirebaseUser

function App() {
  // 'user' here is now of type 'User | null' (Firebase SDK User)
  const { user, loading: authLoading, handleLogout } = useAuth();
  const { socket, activeParticipants } = useSocket();
  const {
    currentRoomId,
    roomData,
    handleJoinRoom: joinRoom,
    handleLeaveRoom: leaveRoom,
    setCurrentRoomId,
    setRoomData,
  } = useRoomManagement();

  // Listen for room-specific events (e.g., roomJoined, loadCode) that need to update App state
  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = (data: { roomId: string, roomName: string, creatorName: string }) => {
      console.log(`Socket.IO confirmed room joined: ${data.roomName}`);
    };

    const onLoadCode = (code: string, language: string) => {
      console.log('App received initial code via loadCode:', code, language);
      setRoomData(prev => prev ? { ...prev, currentCode: code, language: language } : null);
    };

    const onDisconnect = () => {
      setCurrentRoomId(null);
      setRoomData(null);
    };

    socket.on('roomJoined', onRoomJoined);
    socket.on('loadCode', onLoadCode);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('roomJoined', onRoomJoined);
      socket.off('loadCode', onLoadCode);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket, setCurrentRoomId, setRoomData]);

  // Map the full Firebase SDK User to IFirebaseUser for the Header component's props
  const headerUser: IFirebaseUser | null = user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  } : null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Loading application...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Pass the mapped headerUser to the Header component */}
      <Header user={headerUser} onLogout={handleLogout} />

      <main>
        {!user ? (
          <Auth />
        ) : currentRoomId && roomData ? (
          <>
            {/* Placeholder for CodeEditor */}
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
              <h2 className="text-2xl font-semibold mb-4 text-white">
                In Room: {roomData.roomName} (ID: {currentRoomId})
              </h2>
              <p className="text-gray-400 mb-6">
                You are connected! Code editor will go here.
                Initial Code: {roomData.currentCode.substring(0, 50)}...
                Language: {roomData.language}
              </p>
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-2">Active Participants:</h3>
                {activeParticipants.length > 0 ? (
                  <ul className="list-disc list-inside text-left">
                    {activeParticipants.map((p: IActiveParticipant) => (
                      <li key={p.socketId}>{p.displayName}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No other participants yet.</p>
                )}
              </div>
              <button
                onClick={() => socket && leaveRoom(socket)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Leave Room
              </button>
            </div>
          </>
        ) : (
          // No need for 'as FirebaseSDKUser' now, as 'user' is already the correct type
          <RoomLobby onJoinRoom={(id: string) => user && socket && joinRoom(id, user, socket)} userId={user?.uid || ''} />
        )}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;