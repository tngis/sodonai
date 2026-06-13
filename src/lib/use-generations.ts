// Re-export shim. The implementation moved to a shared context provider so the
// always-mounted Header + GenerationNotifier share one fetch/poll instead of
// each running its own getUser() + query + interval. See
// src/contexts/GenerationsContext.tsx.
export {
  useUserGenerations,
  GenerationsProvider,
} from "@/contexts/GenerationsContext";
export type { GenItem } from "@/contexts/GenerationsContext";
