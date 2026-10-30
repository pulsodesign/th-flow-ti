import { useCallback, useEffect, useState } from "react";

export type ThemeId = "claro" | "escuro";

export const THEMES: {
  id: ThemeId;
  label: string;
  className: string;
  padrao?: boolean;
  swatch: string;
}[] = [
  { id: "claro", label: "TH Flow Claro", className: "", padrao: true, swatch: "#eab343" },
  { id: "escuro", label: "TH Flow Escuro", className: "theme-escuro", swatch: "#4a5be0" },
];

const STORAGE_KEY = "thflow:tema";

export function aplicarTema(id: ThemeId) {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;
  for (const t of THEMES) if (t.className) raiz.classList.remove(t.className);
  const alvo = THEMES.find((t) => t.id === id);
  if (alvo?.className) raiz.classList.add(alvo.className);
}

/** Tema atual do usuário, persistido em localStorage. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("claro");

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const valido = THEMES.some((t) => t.id === salvo) ? (salvo as ThemeId) : "claro";
    setThemeState(valido);
    aplicarTema(valido);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    aplicarTema(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { theme, setTheme };
}
