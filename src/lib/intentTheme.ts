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
    primary: "#DC2626", // red-600
    secondary: "#EF4444", // red-500
    accent: "#FEE2E2", // red-100
    bgTint: "rgba(220, 38, 38, 0.05)",
    label: "Decisive",
  },
  natural: {
    primary: "#059669", // emerald-600
    secondary: "#10B981", // emerald-500
    accent: "#D1FAE5", // emerald-100
    bgTint: "rgba(5, 150, 105, 0.05)",
    label: "Natural",
  },
  calm: {
    primary: "#0284C7", // sky-600
    secondary: "#0EA5E9", // sky-500
    accent: "#E0F2FE", // sky-100
    bgTint: "rgba(2, 132, 199, 0.05)",
    label: "Calm",
  },
  persuasive: {
    primary: "#7C3AED", // violet-600
    secondary: "#8B5CF6", // violet-500
    accent: "#EDE9FE", // violet-100
    bgTint: "rgba(124, 58, 237, 0.05)",
    label: "Persuasive",
  },
  empathetic: {
    primary: "#DB2777", // pink-600
    secondary: "#EC4899", // pink-500
    accent: "#FCE7F3", // pink-100
    bgTint: "rgba(219, 39, 119, 0.05)",
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

