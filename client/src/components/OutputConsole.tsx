// client/src/components/OutputConsole.tsx
import React from 'react';

interface OutputConsoleProps {
  output: string;
  isLoading: boolean;
}

const OutputConsole: React.FC<OutputConsoleProps> = ({ output, isLoading }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-2 text-white">Output:</h3>
      <pre className="bg-gray-900 p-3 rounded text-sm text-gray-200 overflow-auto max-h-48 whitespace-pre-wrap">
        {isLoading ? 'Executing code...' : output || 'Code output will appear here.'}
      </pre>
    </div>
  );
};

export default OutputConsole;