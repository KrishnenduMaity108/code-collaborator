// client/src/components/CodeEditor.tsx
import React, { useRef, useState, useCallback } from 'react'; // Added useCallback
import { Socket } from 'socket.io-client';
import { useCollaborativeCodeMirror } from '../hooks/useCollaborativeCodeMirror';
import { type IActiveParticipant } from '../types';
import OutputConsole from './OutputConsole'; // Import the new component
import { auth } from '../firebase'; // Import auth here, as it's needed for getIdToken for execution

const languageOptions = [
  'javascript', 'typescript', 'html', 'css', 'json', 'python', 'java',
  'cpp', 'c', 'php', 'rust', 'sql', 'go', 'markdown', 'text'
];

interface CodeEditorProps {
  socket: Socket | null;
  roomId: string;
  initialCode: string;
  initialLanguage: string;
  activeParticipants: IActiveParticipant[];
  onLeaveRoom: () => void;
  currentUserName: string;
}

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const CodeEditor: React.FC<CodeEditorProps> = ({
  socket,
  roomId,
  initialCode,
  initialLanguage,
  activeParticipants,
  onLeaveRoom,
  currentUserName
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [executionOutput, setExecutionOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');

  const {
    currentLanguage,
    handleLocalLanguageChange,
    isCursorActivityEnabled,
    toggleCursorActivity,
    getCurrentCode,
  } = useCollaborativeCodeMirror(
    editorRef,
    socket,
    roomId,
    initialCode,
    initialLanguage,
    currentUserName
  );

  const onLanguageSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleLocalLanguageChange(event.target.value);
  };

  // Refactored: handleRunCode now lives here, directly using getCurrentCode from the hook
  const handleRunCode = useCallback(async () => {
    if (!socket) {
      setExecutionOutput('Error: Socket not connected.');
      return;
    }

    const code = getCurrentCode();
    if (!code.trim()) {
      setExecutionOutput('Please write some code to execute.');
      return;
    }

    setIsExecuting(true);
    setExecutionOutput(''); // Clear previous output immediately before showing 'Executing...' in console

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/code/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          code,
          language: currentLanguage,
          roomId,
          input: userInput
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Code execution failed on server.');
      }

      const data = await response.json();
      setExecutionOutput(data.output || 'No output.');
    } catch (error: any) {
      console.error('Code execution error:', error);
      setExecutionOutput(`Execution Error: ${error.message || 'An unknown error occurred.'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [socket, currentLanguage, getCurrentCode, roomId, userInput]); // Add dependencies

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4">
      {/* Top Bar: Room ID, Language Selector, Cursor Activity Toggle, and Run Button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-cyan-400">Room: {roomId}</h2>
        <div className="flex items-center space-x-4">
          <label htmlFor="language-select" className="text-gray-300">Language:</label>
          <select
            id="language-select"
            value={currentLanguage}
            onChange={onLanguageSelectChange}
            className="bg-gray-700 border border-gray-600 rounded p-2 text-white"
          >
            {languageOptions.map(lang => (
              <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={toggleCursorActivity}
            className={`py-2 px-4 rounded transition-colors ${isCursorActivityEnabled
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
          >
            {isCursorActivityEnabled ? 'Stop Cursor Activity' : 'Start Cursor Activity'}
          </button>
          <button
            onClick={handleRunCode}
            disabled={isExecuting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      <div ref={editorRef} className="flex-grow border border-gray-700 rounded overflow-hidden mb-4">
      </div>

      {/* input Eliment */}
      <div className="mb-4">
        <label htmlFor="user-input" className="block text-sm font-medium text-gray-300 mb-2">
          User Input (stdin):
        </label>
        <textarea
          id='user-input'
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter input for your code here..."
          className="w-full h-24 p-2 bg-gray-800 border border-gray-700 rounded text-white font-mono"
        />
      </div>

      {/* Render the new OutputConsole component */}
      <OutputConsole output={executionOutput} isLoading={isExecuting} />

      <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg shadow-md">
        <div className="text-gray-300 text-sm">
          <h3 className="font-semibold mb-1 text-white">Participants:</h3>
          {activeParticipants.length > 0 ? (
            <ul className="list-disc list-inside text-left pl-2">
              {activeParticipants.map((p: IActiveParticipant) => (
                <li key={p.socketId} className="text-gray-400">{p.displayName}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No other participants yet.</p>
          )}
        </div>
        <button
          onClick={onLeaveRoom}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};

export default CodeEditor;