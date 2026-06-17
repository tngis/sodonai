"use client";

import { useEffect } from "react";

// Module-level LIFO registry. Each open overlay pushes its close-fn;
// the Android back-button handler pops and calls the top entry.
const closers: Array<() => void> = [];

export function registerEscapeHandler(fn: () => void): () => void {
  closers.push(fn);
  return () => {
    const i = closers.lastIndexOf(fn);
    if (i !== -1) closers.splice(i, 1);
  };
}

// Returns true if a handler was found and called.
export function triggerTopEscapeHandler(): boolean {
  if (closers.length === 0) return false;
  closers[closers.length - 1]();
  return true;
}

// React hook — registers `close` while `isOpen` is true.
export function useEscapeRegister(isOpen: boolean, close: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    return registerEscapeHandler(close);
  }, [isOpen, close]);
}
