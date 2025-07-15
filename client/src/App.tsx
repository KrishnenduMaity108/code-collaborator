import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Auth from './components/Auth';
import RoomLobby from './components/RoomLobby';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';

import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useRoomManagement } from './hooks/useRoomManagement';
import { type IActiveParticipant, type IFirebaseUser } from './types';
import { type User as FirebaseSDKUser } from 'firebase/auth';

function App() {
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

  useEffect(() => {
    // Only attempt to re-join if:
    // 1. User is authenticated and not loading
    // 2. Socket is connected
    // 3. currentRoomId is set (from localStorage in useRoomManagement)
    // 4. roomData is null (meaning we haven't fetched room details yet for this currentRoomId)
    if (user && !authLoading && socket && currentRoomId && !roomData) {
      console.log(`Attempting to re-join room ${currentRoomId} after reload.`);
      joinRoom(currentRoomId, user as FirebaseSDKUser, socket);
    }
  }, [user, authLoading, socket, currentRoomId, roomData, joinRoom]);

  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = (data: { roomId: string, roomName: string, creatorName: string }) => {
      console.log(`Socket.IO confirmed room joined: ${data.roomName}`);
    };

    const onDisconnect = () => {
      setCurrentRoomId(null);
      setRoomData(null);
    };

    socket.on('roomJoined', onRoomJoined);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('roomJoined', onRoomJoined);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket, setCurrentRoomId, setRoomData]);

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

  const currentUserName = user?.displayName || user?.email || 'Anonymous';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Header user={headerUser} onLogout={handleLogout} />

      <main className="flex-grow flex flex-col">
        {!user ? (
          <Auth />
        ) : currentRoomId && roomData && socket ? (
          <>
            <CodeEditor
              socket={socket}
              roomId={currentRoomId}
              initialCode={roomData.currentCode}
              initialLanguage={roomData.language}
              activeParticipants={activeParticipants}
              onLeaveRoom={() => leaveRoom(socket)}
              currentUserName={currentUserName}
            />
          </>
        ) : (
          <RoomLobby onJoinRoom={(id: string) => user && socket && joinRoom(id, user as FirebaseSDKUser, socket)} userId={user?.uid || ''} />
        )}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;