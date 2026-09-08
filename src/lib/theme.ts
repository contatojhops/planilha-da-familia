import { useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const KEY = "cc-theme";
const listeners = new Set<(mode: ThemeMode) => void>();

export function getStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    /* ignore */
  }
  return "system";
}

export function resolveDark(mode: ThemeMode) {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveDark(mode));
}

/** Single source of truth for the theme: header toggle and Ajustes both go through here. */
export function setTheme(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  applyTheme(mode);
  listeners.forEach((listener) => listener(mode));
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(getStoredTheme());
    const listener = (next: ThemeMode) => setMode(next);
    listeners.add(listener);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => applyTheme(getStoredTheme());
    media.addEventListener("change", onSystem);
    return () => {
      listeners.delete(listener);
      media.removeEventListener("change", onSystem);
    };
  }, []);

  return {
    mode,
    isDark: resolveDark(mode),
    setTheme,
    toggle: () => setTheme(resolveDark(mode) ? "light" : "dark"),
  };
}

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Escuro",
};
