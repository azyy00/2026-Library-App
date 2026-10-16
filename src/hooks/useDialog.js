import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

// Dialogs can stack (e.g. Edit opened from a Profile). Only the topmost one
// should react to Escape and Tab.
const openDialogStack = [];

// A trigger that disables itself while loading (e.g. "Searching...") drops
// focus to <body> before the dialog opens, so remember the last real focus.
let lastFocusedElement = null;

if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest?.('[aria-modal="true"]')) {
      lastFocusedElement = event.target;
    }
  });
}

// Keyboard behaviour for modal dialogs: focus moves into the dialog when it
// opens, Tab stays inside it, Escape closes it, and focus returns to whatever
// opened it. Attach the returned ref to the dialog panel (with tabIndex={-1}).
function useDialog(isOpen, onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previouslyFocused = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : lastFocusedElement;
    const dialog = dialogRef.current;
    const stackToken = {};

    openDialogStack.push(stackToken);

    dialog?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (openDialogStack[openDialogStack.length - 1] !== stackToken) {
        return;
      }

      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !dialog) {
        return;
      }

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openDialogStack.splice(openDialogStack.indexOf(stackToken), 1);

      // Wait a frame so a trigger re-enabled by the same state change can take focus.
      window.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen]);

  return dialogRef;
}

export default useDialog;
