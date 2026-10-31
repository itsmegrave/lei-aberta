import path from "node:path";
import { defineConfig } from "vitest/config";

// Component tests (*.test.tsx) run here in jsdom with React Testing Library.
// Plain logic tests (*.test.ts) stay on node:test (see "test:unit" in package.json).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "jsdom",
    include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
  },
});
