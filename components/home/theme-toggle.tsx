"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button variant="outline" className="rounded-full" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}>
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
      Tema
    </Button>
  );
}
