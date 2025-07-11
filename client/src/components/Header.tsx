// code-collaborator-ts-mongo/client/src/components/Header.tsx
import React from 'react';
import { type IFirebaseUser } from '../types';

interface HeaderProps {
  user: IFirebaseUser | null; // This can remain IFirebaseUser
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="flex justify-between items-center p-4 bg-gray-800 shadow-md">
      <h1 className="text-2xl font-bold text-cyan-400">Code Collaborator</h1>
      {user && (
        <div className="flex items-center space-x-4">
          <span className="text-lg">Hello, {user.displayName || user.email}</span>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;