import React, { useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useCollaborativeCodeMirror } from '../hooks/useCollaborativeCodeMirror';
import { type IActiveParticipant } from '../types';

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

  const {
    currentLanguage,
    handleLocalLanguageChange,
    isCursorActivityEnabled, // <--- NEW
    toggleCursorActivity // <--- NEW
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

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4">
      {/* Top Bar: Room ID, Language Selector, and NEW Cursor Activity Toggle */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-cyan-400">Room: {roomId}</h2>
        <div className="flex items-center space-x-4"> {/* Adjusted spacing for new button */}
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
          {/* NEW Button for Cursor Activity */}
          <button
            onClick={toggleCursorActivity}
            className={`py-2 px-4 rounded transition-colors ${isCursorActivityEnabled
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
          >
            {isCursorActivityEnabled ? 'Stop Cursor Activity' : 'Start Cursor Activity'}
          </button>
        </div>
      </div>

      <div ref={editorRef} className="flex-grow border border-gray-700 rounded overflow-hidden mb-4">
      </div>

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