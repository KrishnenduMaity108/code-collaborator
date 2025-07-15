import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';

// CodeMirror imports
import { EditorState, Compartment, type TransactionSpec } from '@codemirror/state';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { basicSetup } from 'codemirror';

// CodeMirror Theme
import { oneDark } from '@codemirror/theme-one-dark';

// Language extensions
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';

import { StreamLanguage } from '@codemirror/language';
import { go } from '@codemirror/legacy-modes/mode/go';

import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { indentWithTab } from '@codemirror/commands';

// Collaboration extension
import { collab } from '@codemirror/collab';

// Import the extracted remote cursors extension
import {
  remoteCursorsField,
  updateRemoteCursorsEffect,
  type RemoteCursorData,
  resetCursorColorMap
} from '../codemirror/remoteCursorsExtension';

// --- Default Code Snippets ---
const defaultCodeSnippets: { [key: string]: string } = {
  javascript: `console.log("Hello, World!");\n\n\n\n`,
  typescript: `console.log("Hello, TypeScript World!");\n\n\n\n`,
  python: `print("Hello, World!")\n\n\n\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n\n\n\n`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n\n\n\n`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n\n\n\n`,
  html: `<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello HTML</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>\n\n\n\n`,
  css: `/* Hello, World! CSS */\nbody {\n    font-family: sans-serif;\n    color: #333;\n}\n\n\n\n`,
  json: `{\n    "message": "Hello, World!"\n}\n\n\n\n`,
  php: `<?php\n\necho "Hello, World!";\n\n?>\n\n\n\n`,
  rust: `fn main() {\n    println!("Hello, World!");\n}\n\n\n\n`,
  sql: `SELECT 'Hello, World!';\n\n\n\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n\n\n\n`,
  markdown: `# Hello, World!\n\nThis is a *Markdown* example.\n\n- Item 1\n- Item 2\n\n\n\n`,
  text: `Hello, World! (Plain Text)\n\n\n\n`
};

// Map language strings to CodeMirror extensions
const languageExtensions: { [key: string]: any } = {
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  html: html(),
  css: css(),
  json: json(),
  python: python(),
  java: java(),
  cpp: cpp(),
  c: cpp(), // Common alias for cpp
  php: php(),
  rust: rust(),
  sql: sql(),
  go: StreamLanguage.define(go), // Example for legacy mode
  markdown: markdown(),
  text: [], // No specific language highlighting for plain text
};

interface UseCodeMirrorResult {
  currentLanguage: string;
  handleLocalLanguageChange: (newLanguage: string) => void;
  isCursorActivityEnabled: boolean; // <--- NEW
  toggleCursorActivity: () => void; // <--- NEW
}

export const useCollaborativeCodeMirror = (
  editorParentRef: React.RefObject<HTMLDivElement | null>,
  socket: Socket | null,
  roomId: string,
  initialCode: string,
  initialLanguage: string,
  displayName: string
): UseCodeMirrorResult => {
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [isCursorActivityEnabled, setIsCursorActivityEnabled] = useState(true); // <--- NEW STATE

  const cursorActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State to hold the latest data for all remote cursors received from the server
  const [remoteCursorData, setRemoteCursorData] = useState<{
    [socketId: string]: RemoteCursorData;
  }>({});

  // Effect for initializing/destroying the CodeMirror editor
  useEffect(() => {
    if (!editorParentRef.current || !socket) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    resetCursorColorMap(); // Reset colors when editor initializes or re-initializes

    const initialLangExtension = languageExtensions[initialLanguage] || javascript();

    const startState = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        autocompletion(),
        history(),
        languageCompartmentRef.current.of(initialLangExtension),
        collab({
          startVersion: 0,
        }),
        oneDark, // Apply the CodeMirror Theme here!
        remoteCursorsField, // Add the remote cursors StateField extension
        // Event listener for local changes
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && socket && roomId) {
            socket.emit('codeChange', { roomId, newCode: update.state.doc.toString() });
          }

          // --- Cursor Activity Tracking (Client Emits 'cursorActivity') ---
          // Only emit if cursor activity is enabled
          if (isCursorActivityEnabled && update.selectionSet && socket && roomId) { // <--- CONDITIONAL EMISSION
            const selection = update.state.selection.main;
            const head = selection.head;
            const anchor = selection.anchor;

            if (cursorActivityTimeoutRef.current) {
              clearTimeout(cursorActivityTimeoutRef.current);
            }

            cursorActivityTimeoutRef.current = setTimeout(() => {
              socket.emit('cursorActivity', {
                roomId,
                position: head,
                selectionStart: Math.min(head, anchor),
                selectionEnd: Math.max(head, anchor),
                displayName: displayName
              });
              cursorActivityTimeoutRef.current = null;
            }, 1000);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorParentRef.current,
    });

    viewRef.current = view;
    setCurrentLanguage(initialLanguage);

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (cursorActivityTimeoutRef.current) {
        clearTimeout(cursorActivityTimeoutRef.current);
      }
      resetCursorColorMap(); // Reset colors when component unmounts
    };
  }, [roomId, socket, editorParentRef, displayName, initialCode, initialLanguage, isCursorActivityEnabled]); // <--- Add isCursorActivityEnabled to deps

  // Effect to dispatch updates to the CodeMirror StateField whenever remoteCursorData changes
  useEffect(() => {
    if (!viewRef.current || !socket) return;

    // Filter out the local user's own cursor from the list of remote cursors to display
    const cursorsToDisplay = Object.values(remoteCursorData)
      .filter(data => data.socketId !== socket.id);

    // Dispatch an effect to update the remoteCursorsField with the new data
    viewRef.current.dispatch({
      effects: updateRemoteCursorsEffect.of(cursorsToDisplay)
    } as TransactionSpec);
  }, [remoteCursorData, socket]);

  // Effect for handling incoming code/language updates from other clients via socket
  useEffect(() => {
    if (!socket || !viewRef.current) return;

    const handleCodeUpdate = (newCode: string) => {
      if (viewRef.current) {
        const currentDoc = viewRef.current.state.doc.toString();
        if (currentDoc !== newCode) {
          viewRef.current.dispatch({
            changes: { from: 0, to: viewRef.current.state.doc.length, insert: newCode }
          });
        }
      }
    };

    const handleLoadCode = (code: string, language: string) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: code }
        });
        if (language !== currentLanguage) {
          viewRef.current.dispatch({
            effects: languageCompartmentRef.current.reconfigure(languageExtensions[language] || javascript())
          });
          setCurrentLanguage(language);
        }
      }
    };

    const handleLanguageUpdate = (newLanguage: string) => {
      if (viewRef.current && newLanguage !== currentLanguage) {
        viewRef.current.dispatch({
          effects: languageCompartmentRef.current.reconfigure(languageExtensions[newLanguage] || javascript())
        });
        setCurrentLanguage(newLanguage);
      }
    };

    // --- Handle Incoming Remote Cursor Activity ---
    const handleRemoteCursorActivity = (data: RemoteCursorData) => {
      setRemoteCursorData(prev => ({
        ...prev,
        [data.socketId]: data,
      }));
    };

    // --- Handle Participant Left (Cleanup Cursors) ---
    const handleParticipantLeft = (data: { socketId: string; displayName: string }) => {
      setRemoteCursorData(prev => {
        const newState = { ...prev };
        delete newState[data.socketId]; // Remove cursor data for disconnected user
        return newState;
      });
    };

    // Register socket listeners
    socket.on('codeUpdate', handleCodeUpdate);
    socket.on('loadCode', handleLoadCode);
    socket.on('languageUpdate', handleLanguageUpdate);
    socket.on('remoteCursorActivity', handleRemoteCursorActivity);
    socket.on('participantLeft', handleParticipantLeft);

    // Cleanup socket listeners on unmount or dependency change
    return () => {
      socket.off('codeUpdate', handleCodeUpdate);
      socket.off('loadCode', handleLoadCode);
      socket.off('languageUpdate', handleLanguageUpdate);
      socket.off('remoteCursorActivity', handleRemoteCursorActivity);
      socket.off('participantLeft', handleParticipantLeft);
    };
  }, [socket, currentLanguage]);

  const handleLocalLanguageChange = useCallback((newLanguage: string) => {
    if (!socket || !roomId || !viewRef.current) return;

    const currentEditorContent = viewRef.current.state.doc.toString();
    let codeToApply = currentEditorContent;
    let shouldUpdateCode = false;

    if (currentEditorContent.trim() === '') {
      codeToApply = defaultCodeSnippets[newLanguage] || '';
      shouldUpdateCode = true;
    } else {
      if (window.confirm(
        `Do you want to replace the current code with "Hello World" for ${newLanguage}? ` +
        `Click OK to replace, Cancel to just change syntax highlighting.`
      )) {
        codeToApply = defaultCodeSnippets[newLanguage] || currentEditorContent;
        shouldUpdateCode = true;
      }
    }

    if (shouldUpdateCode) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: codeToApply }
      });
      socket.emit('codeChange', { roomId, newCode: codeToApply });
    }

    viewRef.current.dispatch({
      effects: languageCompartmentRef.current.reconfigure(languageExtensions[newLanguage] || javascript())
    });
    setCurrentLanguage(newLanguage);

    socket.emit('languageChange', { roomId, newLanguage });
  }, [socket, roomId]);

  // --- NEW: Toggle Cursor Activity Function ---
  const toggleCursorActivity = useCallback(() => {
    setIsCursorActivityEnabled(prev => !prev);
    // Optional: If disabling, you might want to send a "clear my cursor" signal
    // to the server to immediately remove your cursor from other clients.
    // socket.emit('clearMyCursor', { roomId });
  }, []);

  return {
    currentLanguage,
    handleLocalLanguageChange,
    isCursorActivityEnabled, 
    toggleCursorActivity,
  };
};