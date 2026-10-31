"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** True when the dark theme is active. False until mounted, so the server render is stable. */
export function useDark() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === "dark";
}
