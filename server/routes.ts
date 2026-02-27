import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";

// Generate a readable device token (e.g., "DROP-A8F9-Z42")
function generateSessionToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "DROP-";
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  token += "-";
  for (let i = 0; i < 3; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Create or get session
  app.post("/api/sessions", async (req, res) => {
    try {
      const token = generateSessionToken();
      const session = await storage.createSession({
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      res.json({ session });
    } catch (error) {
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Get session info
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ session });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Get session by token
  app.get("/api/sessions/by-token/:token", async (req, res) => {
    try {
      const session = await storage.getSessionByToken(req.params.token);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ session });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Upload file
  app.post("/api/files", async (req, res) => {
    try {
      const { sessionId, uploaderId, name, size, mimeType, data } = req.body;
      console.log('Upload metadata:', { sessionId, uploaderId, name });

      if (!sessionId || !uploaderId || !name || !data) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const file = await storage.createFile({
        sessionId,
        uploaderId,
        name,
        size: size || data.length,
        mimeType: mimeType || "application/octet-stream",
        data,
        expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute expiration
      });

      res.json({ file });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get files for a session
  app.get("/api/sessions/:sessionId/files", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { uploaderId } = req.query;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      let files = await storage.getFilesBySession(sessionId);
      if (uploaderId !== undefined) {
        // If uploaderId is provided (even if empty string), filter strictly
        files = files.filter(f => f.uploaderId === uploaderId);
      }

      res.json({
        files: files.map(f => ({
          ...f,
          size: typeof f.size === 'bigint' ? Number(f.size) : f.size,
          // Don't send the full data for list view
          data: undefined
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Get single file
  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json({ file });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  // Delete file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      await storage.deleteFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Register peer
  app.post("/api/peers", async (req, res) => {
    try {
      const { sessionId, name, deviceType } = req.body;

      if (!sessionId || !name || !deviceType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const peer = await storage.createPeer({
        sessionId,
        name,
        deviceType,
        isOnline: true,
      });

      res.json({ peer });
    } catch (error) {
      console.error("Peer registration error:", error);
      res.status(500).json({ error: "Failed to register peer" });
    }
  });

  // Get peers in session
  app.get("/api/sessions/:sessionId/peers", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const peers = await storage.getPeersBySession(sessionId);
      res.json({ peers });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch peers" });
    }
  });

  // Update peer (heartbeat/online status/name)
  app.patch("/api/peers/:id", async (req, res) => {
    try {
      console.log('PATCH /api/peers body', req.body);
      const { isOnline, name } = req.body;
      const peer = await storage.getPeer(req.params.id);
      if (!peer) {
        return res.status(404).json({ error: "Peer not found" });
      }

      const updateData: any = {};
      if (isOnline !== undefined) updateData.isOnline = isOnline;
      else updateData.isOnline = true;
      if (name !== undefined) updateData.name = name;

      const updated = await storage.updatePeer(req.params.id, updateData);

      res.json({ peer: updated });
    } catch (error) {
      res.status(500).json({ error: "Failed to update peer" });
    }
  });

  // Create transfer
  app.post("/api/transfers", async (req, res) => {
    try {
      const { fileId, senderPeerId, receiverPeerId } = req.body;

      if (!fileId || !senderPeerId || !receiverPeerId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const transfer = await storage.createTransfer({
        fileId,
        senderPeerId,
        receiverPeerId,
        status: "pending",
        progress: 0,
      });

      res.json({ transfer });
    } catch (error) {
      console.error("Transfer creation error:", error);
      res.status(500).json({ error: "Failed to create transfer" });
    }
  });

  // Get transfers for a file
  app.get("/api/files/:fileId/transfers", async (req, res) => {
    try {
      const transfers = await storage.getTransfersByFile(req.params.fileId);
      res.json({
        transfers: transfers.map(t => ({
          ...t,
          progress: typeof t.progress === 'bigint' ? Number(t.progress) : t.progress
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transfers" });
    }
  });

  // Get files received by a peer
  app.get("/api/peers/:peerId/received-files", async (req, res) => {
    try {
      const { peerId } = req.params;
      const peers = await storage.getPeersBySession(""); // This is just to get all, we'll filter
      // Actually, we need a way to get transfers by receiver
      // I'll check storage implementation...
      const transfers = Array.from((storage as any).transfers.values() as any[])
        .filter((t: any) => t.receiverPeerId === peerId);

      const files = [];
      for (const t of transfers) {
        const file = await storage.getFile(t.fileId);
        if (file) {
          files.push({
            ...file,
            size: typeof file.size === 'bigint' ? Number(file.size) : file.size,
            data: undefined // Don't send data here
          });
        }
      }
      res.json({ files });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch received files" });
    }
  });

  // Update transfer progress
  app.patch("/api/transfers/:id", async (req, res) => {
    try {
      const { status, progress } = req.body;
      const transfer = await storage.getTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: "Transfer not found" });
      }

      const updated = await storage.updateTransfer(req.params.id, {
        status: status || undefined,
        progress: progress !== undefined ? progress : undefined,
      });

      res.json({
        transfer: {
          ...updated,
          progress: typeof updated.progress === 'bigint' ? Number(updated.progress) : updated.progress
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update transfer" });
    }
  });

  // Cleanup expired files
  app.post("/api/cleanup", async (req, res) => {
    try {
      await storage.deleteExpiredFiles();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Cleanup failed" });
    }
  });

  // Periodic cleanup
  setInterval(async () => {
    try {
      await storage.deleteExpiredFiles();
    } catch (error) {
      console.error("Scheduled cleanup failed:", error);
    }
  }, 30 * 1000); // Every 30 seconds

  return httpServer;
}
