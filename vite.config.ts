import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    // Allow Caddy to proxy requests
    host: "localhost",
    port: 3000,
  },
  ssr: {
    // Externalize server-only dependencies to prevent client bundling
    noExternal: [],
    external: ["bcryptjs", "jsonwebtoken", "@prisma/client"]
  },
  optimizeDeps: {
    // Don't prebundle server-only dependencies
    exclude: ["bcryptjs", "jsonwebtoken", "@prisma/client"]
  },
  build: {
    rollupOptions: {
      external: ["bcryptjs", "jsonwebtoken"]
    }
  }
});
