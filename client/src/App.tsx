import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import toast, { Toaster } from "react-hot-toast";
import  Auth  from "./components/Auth"
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

const SOCKET_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

console.log("Socket URL:", SOCKET_SERVER_URL); ///////////////

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState<string>('');
  const [receivedMessage, setReceivedMessage] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [mongoUser, setMongoUser] = useState<any>(null);

  useEffect(() => {
    const newSocket : Socket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Socket>IO server!');
      toast.success('Connected to Server!');
    });
  
    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server!');
      toast.error('Disconnected from server!');
    });
    
    newSocket.on('helloFromServer', (msg: string) =>{
      console.log(msg);
      setReceivedMessage(msg)
      toast(`Server says: ${msg}`, {
        icon: 'ℹ️',
      });
    });
    
    return () => {
      newSocket.disconnect();
    };

  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if(authUser){
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

          if(!response.ok){
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
      }
    });

    return () => unsubscribe();
    
  }, [])

  const sendMessage = () => {
    if(socket && message){
      socket.emit('helloFromClient', message);
      setMessage('');
    }
  }

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      {user ? (
      <>
        <h1 className="text-3xl font-bold mb-6 text-cyan-400">Code Collaborator</h1>
        <p className="text-lg mb-2">Welcome, {mongoUser?.dispayName || user.email}!</p>
        <p className="text-sm text-gray-400 mb-4">Your MongoDB ID: {mongoUser?._id}</p>
        <div className="mb-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message to server..."
            className="p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 mr-2"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors"
          > Send to Server</button>
        </div>
        {receivedMessage && (
          <p className="text-green-400">Received from Server: {receivedMessage}</p>
        )}
        <button
          onClick={handleLogout}
          className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Logout
        </button>
      </>
      ) : (
        <Auth />
      )}
      <Toaster position="top-right"/>
    </div>
  );
}

export default App;