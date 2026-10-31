"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";

/** Theme plus motion settings. `reducedMotion="user"` makes every Motion animation honor the OS "reduce motion" setting. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="lei-aberta-theme">
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
