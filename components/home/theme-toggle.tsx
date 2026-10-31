"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  // The accessible name starts with the visible word "Tema" (WCAG 2.5.3, label in name).
  return (
    <Button variant="outline" className="ml-1 rounded-full max-sm:size-9 max-sm:px-0" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Tema: usar claro" : "Tema: usar escuro"}>
      <SunIcon className="hidden dark:block" aria-hidden />
      <MoonIcon className="dark:hidden" aria-hidden />
      {/* Icon only on phones, to fit the bar; the accessible name stays the same. */}
      <span className="hidden sm:inline">Tema</span>
    </Button>
  );
}
