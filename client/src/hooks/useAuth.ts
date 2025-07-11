// code-collaborator-ts-mongo/client/src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut } from 'firebase/auth'; // Import User directly from firebase/auth
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { type IMongoUser } from '../types'; // Only IMongoUser is needed from types/index.ts now

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface UseAuthResult {
  user: User | null; // <-- CHANGE THIS LINE to use Firebase SDK's User type
  mongoUser: IMongoUser | null;
  loading: boolean;
  handleLogout: () => Promise<void>;
}

export const useAuth = (): UseAuthResult => {
  // State now holds the actual Firebase SDK User object
  const [user, setUser] = useState<User | null>(null);
  const [mongoUser, setMongoUser] = useState<IMongoUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Now, authUser is directly assigned. No need for mapping to IFirebaseUser.
        setUser(authUser);

        try {
          const idToken = await authUser.getIdToken();
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
        } catch (error) {
          console.error('Error syncing user with backend:', error);
          toast.error('Failed to sync user data with MongoDB.');
          signOut(auth); // Sign out if sync fails
        }
      } else {
        setUser(null);
        setMongoUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully!');
    } catch (error: any) {
      console.error('Error logging out:', error.message);
      toast.error('Failed to log out.');
    }
  };

  return { user, mongoUser, loading, handleLogout };
};