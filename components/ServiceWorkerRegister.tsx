"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorName = reason instanceof Error ? reason.name : typeof reason;
      const chunkLoadError =
        reason instanceof Error &&
        /ChunkLoadError|Loading chunk|Failed to load chunk/i.test(reason.message);
      console.error(
        JSON.stringify({
          level: "error",
          event: "client.unhandled_rejection",
          time: new Date().toISOString(),
          errorName,
          chunkLoadError
        })
      );
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
