import { app, httpServer, log } from "./app.js";
import { storage } from "./storage.js";
import { serveStatic } from "./static.js";

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
const connectedPeers = new Map<string, Set<any>>();
const peerSessions = new Map<any, { peerId: string; sessionId: string }>();

// Broadcast message to all peers in a session
export function broadcastToSession(sessionId: string, message: any) {
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

if (process.env.VERCEL !== "1") {
  (async () => {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite.js");
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

export { app, httpServer };
