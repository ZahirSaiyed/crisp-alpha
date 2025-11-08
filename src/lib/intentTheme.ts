/**
 * Intent-based theming system
 * Maps user intents to color themes and CSS variables
 */

export type Intent = "decisive" | "natural" | "calm" | "persuasive" | "empathetic";

export interface IntentTheme {
  primary: string;
  secondary: string;
  accent: string;
  bgTint: string;
  label: string;
}

const INTENT_THEMES: Record<Intent, IntentTheme> = {
  decisive: {
    primary: "#F59E0B", // Amber
    secondary: "#FBBF24", // amber-400
    accent: "#FEF3C7", // amber-100
    bgTint: "rgba(245, 158, 11, 0.05)",
    label: "Decisive",
  },
  natural: {
    primary: "#0EA5E9", // Sky
    secondary: "#38BDF8", // sky-400
    accent: "#E0F2FE", // sky-100
    bgTint: "rgba(14, 165, 233, 0.05)",
    label: "Natural",
  },
  calm: {
    primary: "#10B981", // Sage/Green
    secondary: "#34D399", // emerald-400
    accent: "#D1FAE5", // emerald-100
    bgTint: "rgba(16, 185, 129, 0.05)",
    label: "Calm",
  },
  persuasive: {
    primary: "#7C3AED", // Violet
    secondary: "#8B5CF6", // violet-500
    accent: "#EDE9FE", // violet-100
    bgTint: "rgba(124, 58, 237, 0.05)",
    label: "Persuasive",
  },
  empathetic: {
    primary: "#FB7185", // Coral
    secondary: "#FCA5A5", // rose-300
    accent: "#FCE7F3", // rose-100
    bgTint: "rgba(251, 113, 133, 0.05)",
    label: "Empathetic",
  },
};

/**
 * Get theme for a given intent
 */
export function getIntentTheme(intent: Intent | null | undefined): IntentTheme | null {
  if (!intent) return null;
  return INTENT_THEMES[intent] || null;
}

/**
 * Apply intent theme CSS variables to document root
 * Call this when intent is set
 */
export function applyIntentTheme(intent: Intent | null | undefined): void {
  if (typeof document === "undefined") return;

  const theme = getIntentTheme(intent);
  const root = document.documentElement;

  if (!theme) {
    // Reset to defaults
    root.style.removeProperty("--intent-primary");
    root.style.removeProperty("--intent-secondary");
    root.style.removeProperty("--intent-accent");
    root.style.removeProperty("--intent-bg-tint");
    return;
  }

  root.style.setProperty("--intent-primary", theme.primary);
  root.style.setProperty("--intent-secondary", theme.secondary);
  root.style.setProperty("--intent-accent", theme.accent);
  root.style.setProperty("--intent-bg-tint", theme.bgTint);
}

/**
 * Remove intent theme CSS variables
 * Call this on component unmount to prevent leaks
 */
export function removeIntentTheme(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.removeProperty("--intent-primary");
  root.style.removeProperty("--intent-secondary");
  root.style.removeProperty("--intent-accent");
  root.style.removeProperty("--intent-bg-tint");
}

/**
 * Get intent label for display
 */
export function getIntentLabel(intent: Intent | null | undefined): string {
  if (!intent) return "";
  return INTENT_THEMES[intent]?.label || intent;
}

