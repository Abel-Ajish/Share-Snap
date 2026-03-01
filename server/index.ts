import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);
let wss: any = null;

if (process.env.VERCEL !== "1") {
  (async () => {
    try {
      const { WebSocketServer } = await import("ws");
      // WebSocket server setup - only for our custom protocol
      wss = new WebSocketServer({ server: httpServer, path: "/ws" });
      setupWebSocketEvents(wss);
    } catch (e) {
      console.error("WS INIT ERROR", e);
    }
  })();
}

function setupWebSocketEvents(wss: any) {
  wss.on("connection", (ws: any) => {
    let peerId: string | null = null;
    let sessionId: string | null = null;

    ws.on("message", async (data: string | Buffer) => {
      try {
        const dataStr = typeof data === "string" ? data : data.toString();
        const message = JSON.parse(dataStr);
        const { type, peerId: msgPeerId, sessionId: msgSessionId, payload } = message;

        if (type === "join") {
          peerId = msgPeerId || null;
          sessionId = msgSessionId || null;

          if (sessionId && peerId) {
            if (!connectedPeers.has(sessionId)) {
              connectedPeers.set(sessionId, new Set());
            }
            connectedPeers.get(sessionId)!.add(ws);
            peerSessions.set(ws, { peerId, sessionId });

            // Update peer online status
            const peer = await storage.getPeer(peerId);
            if (peer) {
              await storage.updatePeer(peerId, { isOnline: true });
            }

            // Broadcast peer joined
            broadcastToSession(sessionId, {
              type: "peer-joined",
              peerId,
              peers: Array.from(connectedPeers.get(sessionId) || []).length,
            });
          }
        } else if (type === "ping") {
          // Keep-alive ping
          ws.send(JSON.stringify({ type: "pong" }));
          if (peerId && sessionId) {
            const peer = await storage.getPeer(peerId);
            if (peer) {
              await storage.updatePeer(peerId, { isOnline: true });
            }
          }
        } else if (type === "transfer-start") {
          // Notify about file transfer start
          if (sessionId) {
            broadcastToSession(sessionId, {
              type: "transfer-start",
              transferId: payload.transferId,
              fromPeerId: peerId,
              toPeerId: payload.toPeerId,
              fileName: payload.fileName,
            });
          }
        } else if (type === "transfer-progress") {
          // Update transfer progress
          if (sessionId) {
            broadcastToSession(sessionId, {
              type: "transfer-progress",
              transferId: payload.transferId,
              progress: payload.progress,
            });
          }
        } else if (type === "transfer-complete") {
          // Notify transfer complete
          if (sessionId) {
            broadcastToSession(sessionId, {
              type: "transfer-complete",
              ...payload
            });
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", async () => {
      if (peerId && sessionId) {
        // Update peer offline status
        const peer = await storage.getPeer(peerId);
        if (peer) {
          await storage.updatePeer(peerId, { isOnline: false });
        }

        // Remove from connected peers
        connectedPeers.get(sessionId)?.delete(ws);

        // Broadcast peer left
        broadcastToSession(sessionId, {
          type: "peer-left",
          peerId,
          peers: (connectedPeers.get(sessionId) || new Set()).size,
        });
      }
      peerSessions.delete(ws);
    });

    ws.on("error", (error: any) => {
      console.error("WebSocket error:", error);
    });
  });
}

// Track connected peers
const connectedPeers = new Map<string, Set<WebSocket>>();
const peerSessions = new Map<WebSocket, { peerId: string; sessionId: string }>();


// Broadcast message to all peers in a session
function broadcastToSession(sessionId: string, message: any) {
  if (!wss) return;
  const peers = connectedPeers.get(sessionId);
  if (peers) {
    peers.forEach((wsConnection) => {
      if (wsConnection.readyState === 1) { // 1 = OPEN
        wsConnection.send(JSON.stringify(message));
      }
    });
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    // allow payloads up to 10MB so users can drop reasonably large files
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Register routes immediately so they are available when the app is exported
registerRoutes(httpServer, app);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("Internal Server Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({ message });
});

export { app, httpServer };

if (process.env.VERCEL !== "1") {
  (async () => {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  })();
}
