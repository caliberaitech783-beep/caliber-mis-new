// Only used by explicit Vite preview mode. Never connect to the backend proxy.
export function previewGuard() {
  return {
    name: "local-preview-api-guard",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        res.statusCode = 501;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              "LOCAL MOCK: this service/navigation is unavailable. No backend is connected.",
          }),
        );
      });
    },
  };
}
