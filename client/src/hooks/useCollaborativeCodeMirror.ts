// client/src/hooks/useCollaborativeCodeMirror.ts
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
} from '../codemirror/remoteCursorsExtension'; // Ensure this path is correct

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
  go: StreamLanguage.define(go),
  markdown: markdown(),
  text: [], // No specific language highlighting for plain text
};

interface UseCodeMirrorResult {
  currentLanguage: string;
  handleLocalLanguageChange: (newLanguage: string) => void;
  isCursorActivityEnabled: boolean;
  toggleCursorActivity: () => void;
  getCurrentCode: () => string;
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
  // NOTE: cursorActivityCompartmentRef is no longer strictly needed for controlling emission,
  // but we can keep it for consistency or if we want to re-introduce features later.
  const cursorActivityCompartmentRef = useRef(new Compartment());
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  // isCursorActivityEnabled now only controls local rendering, not sending
  const [isCursorActivityEnabled, setIsCursorActivityEnabled] = useState(true);

  const cursorActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State to hold the latest data for all remote cursors received from the server
  const [remoteCursorData, setRemoteCursorData] = useState<{
    [socketId: string]: RemoteCursorData;
  }>({});

  // Memoize the update listener that **always emits** cursor positions.
  // The `enabled` parameter is now effectively unused within this function.
  // We keep the `enabled` parameter in the signature for consistency
  // with how it was previously used with the compartment, but its internal
  // check is removed.
  const createUpdateListener = useCallback(() => { // Removed 'enabled: boolean' parameter
    return EditorView.updateListener.of((update: ViewUpdate) => {
      // Always emit code changes
      if (update.docChanged && socket && roomId) {
        socket.emit('codeChange', { roomId, newCode: update.state.doc.toString() });
      }

      // Always emit cursor activity if there's a selection change
      // This is the core change: NO LONGER CONDITIONAL ON `enabled`
      if (update.selectionSet && socket && roomId) {
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
        }, 100);
      }
    });
  }, [socket, roomId, displayName]); // Dependencies are still important for `useCallback`

  // --- EFFECT 1: Editor Initialization ---
  useEffect(() => {
    if (!editorParentRef.current || !socket) {
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    resetCursorColorMap();

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
        oneDark,
        remoteCursorsField,
        // The update listener is now always added without conditional 'enabled'
        cursorActivityCompartmentRef.current.of(createUpdateListener()),
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
      resetCursorColorMap();
    };
  }, [roomId, socket, editorParentRef, displayName, initialCode, initialLanguage, createUpdateListener]);

  // --- EFFECT 2: (No longer needed for reconfiguring emission) ---
  // This effect can now be removed, as the emission logic is no longer
  // controlled by `isCursorActivityEnabled`. The `createUpdateListener`
  // doesn't depend on `isCursorActivityEnabled` anymore.
  // Keeping it here commented out for clarity of removal.
  /*
  useEffect(() => {
      if (viewRef.current) {
          // This compartment and its reconfigure are no longer necessary
          // since createUpdateListener no longer takes an 'enabled' parameter.
          // The emission of cursor events is now unconditional.
          // viewRef.current.dispatch({
          //     effects: cursorActivityCompartmentRef.current.reconfigure(
          //         createUpdateListener()
          //     )
          // });
      }
  }, [isCursorActivityEnabled, createUpdateListener]);
  */

  // --- EFFECT 3: Update Remote Cursors on Screen ---
  // This effect runs when remoteCursorData changes OR when `isCursorActivityEnabled` changes.
  // It filters/clears the displayed cursors based on local `isCursorActivityEnabled` state.
  useEffect(() => {
    if (!viewRef.current || !socket) return;

    let cursorsToDisplay: RemoteCursorData[] = [];

    // If *this client's* cursor activity is enabled, then we display others' cursors.
    // Otherwise, we display an empty array, effectively clearing all remote cursors on this screen.
    if (isCursorActivityEnabled) {
      cursorsToDisplay = Object.values(remoteCursorData)
        .filter(data => data.socketId !== socket.id); // Filter out own cursor
    } else {
      cursorsToDisplay = []; // If local cursor activity is off, clear all remote cursors from view
    }

    viewRef.current.dispatch({
      effects: updateRemoteCursorsEffect.of(cursorsToDisplay)
    } as TransactionSpec);
  }, [remoteCursorData, socket, isCursorActivityEnabled]); // Crucially depends on isCursorActivityEnabled

  // --- EFFECT 4: Handle Incoming Socket Events ---
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

    const handleRemoteCursorActivity = (data: RemoteCursorData) => {
      // This listener always updates remoteCursorData state.
      // The decision to *render* these cursors is made in EFFECT 3 based on `isCursorActivityEnabled`.
      setRemoteCursorData(prev => ({
        ...prev,
        [data.socketId]: data,
      }));
    };

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

  // Handles local language change and emits to others
  const handleLocalLanguageChange = useCallback((newLanguage: string) => {
    if (!socket || !roomId || !viewRef.current) return;

    const currentEditorContent = viewRef.current.state.doc.toString();
    let codeToApply = currentEditorContent;
    let shouldUpdateCode = false;

    // If current content is empty, apply default snippet
    if (currentEditorContent.trim() === '') {
      codeToApply = defaultCodeSnippets[newLanguage] || '';
      shouldUpdateCode = true;
    } else {
      // Only prompt if a change is suggested and current content is not empty
      if (defaultCodeSnippets[newLanguage] && window.confirm(
        `Do you want to replace the current code with "Hello World" for ${newLanguage}? ` +
        `Click OK to replace, Cancel to just change syntax highlighting.`
      )) {
        codeToApply = defaultCodeSnippets[newLanguage]; // Use default if confirmed
        shouldUpdateCode = true;
      } else {
        codeToApply = currentEditorContent; // Keep current code
      }
    }

    if (shouldUpdateCode) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: codeToApply }
      });
      socket.emit('codeChange', { roomId, newCode: codeToApply });
    }

    // Always reconfigure language extension regardless of code change
    viewRef.current.dispatch({
      effects: languageCompartmentRef.current.reconfigure(languageExtensions[newLanguage] || javascript())
    });
    setCurrentLanguage(newLanguage);

    socket.emit('languageChange', { roomId, newLanguage });
  }, [socket, roomId]);

  // Toggles the local `isCursorActivityEnabled` state.
  // This state now ONLY affects the local rendering of remote cursors (via EFFECT 3).
  // It NO LONGER affects the emission of your own cursor data.
  const toggleCursorActivity = useCallback(() => {
    setIsCursorActivityEnabled(prev => !prev);
  }, []);

  // Returns the current code from the CodeMirror editor
  const getCurrentCode = useCallback(() => {
    if (viewRef.current) {
      return viewRef.current.state.doc.toString();
    }
    return '';
  }, []);

  return {
    currentLanguage,
    handleLocalLanguageChange,
    isCursorActivityEnabled,
    toggleCursorActivity,
    getCurrentCode,
  };
};