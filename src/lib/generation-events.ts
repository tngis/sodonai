// Broadcasts that the user just kicked off a new generation. Any mounted
// useUserGenerations() instance listens and reloads immediately, so it starts
// polling right away — the global "done" toast then fires without waiting for
// the next manual reload or page navigation.

export const GENERATION_STARTED_EVENT = "generation-started";

export function notifyGenerationStarted(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GENERATION_STARTED_EVENT));
}
