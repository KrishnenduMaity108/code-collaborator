// client/src/codemirror/remoteCursorsExtension.ts

import { StateField, StateEffect, type Extension, RangeSetBuilder } from '@codemirror/state'; // Import RangeSetBuilder directly
import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view';

// --- Remote Cursor Data Interface ---
export interface RemoteCursorData {
  socketId: string;
  displayName: string;
  position: number;
  selectionStart: number;
  selectionEnd: number;
}

// --- Remote Cursor Colors (simple palette) ---
const cursorColors = [
  '#ec7f7aff', // Red
  '#71e97fff', // Green
  '#419dedff', // Blue
  '#f4df57ff', // Yellow
  '#f7a257ff', // Orange
  '#f77eb8ff', // Purple
  '#31e3e3ff', // Teal
  '#AAAAAA', // Gray
];

// Map socketId to a unique color for consistent rendering
const userColorMap = new Map<string, string>();
let colorIndex = 0; // Keep track of assigned colors

// Function to assign a consistent color to a user based on their socketId
function getUserColor(socketId: string) {
  if (!userColorMap.has(socketId)) {
    userColorMap.set(socketId, cursorColors[colorIndex % cursorColors.length]);
    colorIndex++;
  }
  return userColorMap.get(socketId)!;
}

// --- State Effect for Remote Cursor Updates ---
// This effect type will be dispatched to update the remote cursors StateField
export const updateRemoteCursorsEffect = StateEffect.define<RemoteCursorData[]>();

// --- Remote Cursor StateField ---
// This StateField manages the DecorationSet for all remote cursors and selections.
export const remoteCursorsField = StateField.define<DecorationSet>({
  // Initial value: an empty DecorationSet
  create() {
    return Decoration.none;
  },
  // Update logic: when the 'updateRemoteCursorsEffect' effect is dispatched,
  // we regenerate the entire DecorationSet.
  update(decorations, tr) {
    // Start with the current decorations, mapped through any changes in the document
    let currentDecorations = decorations.map(tr.changes);

    // Check for our custom effect to update remote cursors
    for (let effect of tr.effects) {
      if (effect.is(updateRemoteCursorsEffect)) {
        // CORRECTED: Use new RangeSetBuilder() for direct building
        const builder: RangeSetBuilder<Decoration> = new RangeSetBuilder();

        // Cast effect.value to the expected type
        const remoteCursors: RemoteCursorData[] = effect.value;

        remoteCursors.forEach(cursorData => {
          const color = getUserColor(cursorData.socketId);

          // 1. Selection Highlight (if any)
          if (cursorData.selectionStart !== cursorData.selectionEnd) {
            builder.add(
              cursorData.selectionStart,
              cursorData.selectionEnd,
              Decoration.mark({
                attributes: {
                  style: `background-color: ${color}40;` // Add transparency (40)
                },
                class: 'cm-remote-selection'
              })
            );
          }

          // 2. Cursor Line (widget)
          const cursorElement = document.createElement('div');
          cursorElement.className = 'cm-remote-cursor';
          cursorElement.style.borderLeft = `2px solid ${color}`;
          cursorElement.style.height = '1.2em'; // Adjust based on line height
          cursorElement.style.marginLeft = '-1px'; // Center the border
          cursorElement.style.position = 'relative';

          // Create a label for the cursor
          const labelElement = document.createElement('span');
          labelElement.className = 'cm-remote-cursor-label';
          labelElement.textContent = cursorData.displayName || 'Guest';
          labelElement.style.backgroundColor = color;
          labelElement.style.color = 'white';
          labelElement.style.padding = '2px 5px';
          labelElement.style.fontSize = '0.7em';
          labelElement.style.borderRadius = '3px';
          labelElement.style.position = 'absolute';
          labelElement.style.top = '-1.5em'; // Position above cursor
          labelElement.style.left = '0';
          labelElement.style.whiteSpace = 'nowrap';
          labelElement.style.zIndex = '10'; // Ensure it's above code

          cursorElement.appendChild(labelElement);

          builder.add(
            cursorData.position,
            cursorData.position,
            Decoration.widget({
              widget: new (class extends WidgetType {
                // Explicitly type these properties to avoid 'any'
                private cursorData: RemoteCursorData;
                private element: HTMLElement;

                constructor(cursorData: RemoteCursorData, element: HTMLElement) {
                  super();
                  this.cursorData = cursorData;
                  this.element = element;
                }

                toDOM(_view: EditorView) { // Use _view to mark as unused if not needed
                  return this.element;
                }

                updateDOM(_dom: HTMLElement, _view: EditorView) { // Use _dom, _view for unused
                  return false;
                }

                eq(other: WidgetType) {
                  // Ensure safe access to cursorData for comparison
                  if (other instanceof (this.constructor as any) && (other as any).cursorData !== undefined) {
                    const otherWidget = other as (typeof this);
                    return this.cursorData.socketId === otherWidget.cursorData.socketId &&
                      this.cursorData.position === otherWidget.cursorData.position &&
                      this.cursorData.selectionStart === otherWidget.cursorData.selectionStart &&
                      this.cursorData.selectionEnd === otherWidget.cursorData.selectionEnd &&
                      this.cursorData.displayName === otherWidget.cursorData.displayName;
                  }
                  return false;
                }

                get estimatedHeight() { return -1; }
                get lineBreaks() { return 0; }
                ignoreEvent(_event: Event) { return true; } // Use _event for unused
                coordsAt(_dom: HTMLElement, _pos: number, _side: number) { return null; }
                destroy(_dom: HTMLElement) { /* No specific cleanup needed for this widget */ }

              })(cursorData, cursorElement),
              side: -1,
              block: false,
            })
          );
        });
        currentDecorations = builder.finish();
      }
    }
    return currentDecorations;
  },
  // Map decorations when editor content changes
  provide: (f) => EditorView.decorations.from(f),
});

// Function to reset the color map when a user disconnects or editor unmounts
export function resetCursorColorMap() {
  userColorMap.clear();
  colorIndex = 0;
}

// Optional: Combine into a single extension if preferred
export const remoteCursorsExtension: Extension = [
  remoteCursorsField
];