import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ngrokHost = (env.NGROK_HOST || "").trim();
  const useNgrokTunnelDev =
    ngrokHost && (env.VITE_USE_NGROK_TUNNEL || "").trim() === "1";
  const ngrokHmrEnabled = (env.VITE_NGROK_HMR || "").trim() === "1";

  const apiProxy = {
    "/api": { target: "http://localhost:4000", changeOrigin: true },
    "/uploads": { target: "http://localhost:4000", changeOrigin: true },
  };

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: apiProxy,
      allowedHosts: [
        "engagehub.onrender.com",
        "engage-hub-chi.vercel.app",
        ".ngrok-free.dev",
        ".ngrok-free.app",
        ".ngrok.io",
        ".ngrok.app",
      ],
      ...(useNgrokTunnelDev
        ? {
            origin: `https://${ngrokHost}`,
            ...(ngrokHmrEnabled
              ? {
                  hmr: {
                    host: ngrokHost,
                    protocol: "wss",
                    clientPort: 443,
                  },
                }
              : { hmr: false }),
          }
        : {}),
    },
    preview: {
      proxy: apiProxy,
    },
  };
});
