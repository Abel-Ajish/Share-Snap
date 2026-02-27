import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

type FileItem = {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  expiresAt: Date;
  status: "uploading" | "ready" | "sending" | "sent";
  progress: number;
};

type Peer = {
  id: string;
  name: string;
  deviceType: "phone" | "laptop" | "tablet" | "desktop";
  isOnline: boolean;
};

type Transfer = {
  id: string;
  fileId: string;
  senderPeerId: string;
  receiverPeerId: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  progress: number;
};

interface UseShareSnapOptions {
  peerId?: string;
  peerName?: string;
  deviceType?: "phone" | "laptop" | "tablet" | "desktop";
  sessionToken?: string;
}

export function useShareSnap(options: UseShareSnapOptions = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [transfers, setTransfers] = useState<Map<string, Transfer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPeerId, setCurrentPeerId] = useState<string | null>(null);
  const [currentPeerName, setCurrentPeerName] = useState<string>(options.peerName || "My Device");
  const wsRef = useRef<WebSocket | null>(null);
  const peerIdRef = useRef<string>(options.peerId || "");
  const peersRef = useRef(new Set<string>());

  // Initialize session (with localStorage persistence)
  useEffect(() => {
    const storageKey = "shareSnapSession";
    const peerKey = "shareSnapPeer";

    const initSession = async () => {
      try {
        setIsLoading(true);
        let session: { id: string; token: string } | null = null;

        // If a session token is provided in options, try to use it
        if (options.sessionToken) {
          try {
            const res = await apiRequest("GET", `/api/sessions/by-token/${options.sessionToken}`);
            const data = await res.json();
            session = data.session;
            localStorage.setItem(storageKey, JSON.stringify(session));
          } catch (err) {
            // Token is invalid or expired
            console.error("Invalid session token:", err);
            session = null;
          }
        }

        // If no session from token, try to read saved session
        if (!session) {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const res = await apiRequest("GET", `/api/sessions/${parsed.id}`);
              const data = await res.json();
              session = data.session;
            } catch (err) {
              // session invalid or expired, ignore
              session = null;
            }
          }
        }

        // If still no session, create a new one
        if (!session) {
          const res = await apiRequest("POST", "/api/sessions");
          const data = await res.json();
          session = data.session;
          localStorage.setItem(storageKey, JSON.stringify(session));
        }

        setSessionId(session.id);
        setSessionToken(session.token);

        // register peer or reuse saved peer
        let peerData: any = null;
        const savedPeer = localStorage.getItem(peerKey);
        if (savedPeer) {
          try {
            peerData = JSON.parse(savedPeer);
            // ping server to update isOnline
            await apiRequest("PATCH", `/api/peers/${peerData.id}`, {
              isOnline: true,
            });
            setCurrentPeerId(peerData.id);
            setCurrentPeerName(peerData.name);
            peerIdRef.current = peerData.id; // Update with actual peer ID
          } catch {
            peerData = null;
          }
        }

        if (!peerData) {
          const peerRes = await apiRequest("POST", "/api/peers", {
            sessionId: session.id,
            name: options.peerName || "My Device",
            deviceType: options.deviceType || "laptop",
          });
          peerData = await peerRes.json();
          if (peerData.peer && peerData.peer.id) {
            setCurrentPeerId(peerData.peer.id);
            setCurrentPeerName(peerData.peer.name);
            peerIdRef.current = peerData.peer.id; // Update with actual peer ID
            localStorage.setItem(peerKey, JSON.stringify(peerData.peer));
          }
        }

        setIsLoading(false);
        return session.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize session");
        setIsLoading(false);
      }
    };

    initSession();
  }, [options.deviceType, options.peerName, options.sessionToken]);

  // Connect to WebSocket
  useEffect(() => {
    if (!sessionId || !currentPeerId) return; // Wait for both session and peer to be registered

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "join",
          peerId: peerIdRef.current,
          sessionId: sessionId,
        }));

        // Send periodic ping to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // Every 30 seconds

        return () => clearInterval(pingInterval);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "peer-joined":
              peersRef.current.add(message.peerId);
              fetchPeers();
              break;
            case "peer-left":
              peersRef.current.delete(message.peerId);
              fetchPeers();
              break;
            case "transfer-start":
              // Handle transfer start
              break;
            case "transfer-progress":
              // Update transfer progress
              break;
            case "transfer-complete":
              // Handle transfer complete
              break;
            case "pong":
              // Keep-alive response
              break;
          }
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error");
      };

      ws.onclose = () => {
        // Attempt to reconnect after delay
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [sessionId, currentPeerId]);

  // Fetch peers
  const fetchPeers = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/peers`);
      const data = await res.json();
      setPeers(data.peers || []);
    } catch (err) {
      console.error("Failed to fetch peers:", err);
    }
  }, [sessionId]);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/files`);
      const data = await res.json();
      setFiles((data.files || []).map((f: any) => ({
        ...f,
        size: BigInt(f.size),
        expiresAt: new Date(f.expiresAt),
        status: f.status || "ready",
        progress: 100,
      })));
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  }, [sessionId]);

  // Upload file
  const uploadFile = useCallback(
    async (file: File) => {
      if (!sessionId) {
        setError("No session");
        return;
      }

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = e.target?.result as string;
          
          // Add to files list with uploading status
          const fileItem: FileItem = {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            size: BigInt(file.size),
            mimeType: file.type || "application/octet-stream",
            expiresAt: new Date(Date.now() + 60000),
            status: "uploading",
            progress: 0,
          };

          setFiles((prev) => [...prev, fileItem]);

          // Simulate upload progress
          let progress = 0;
          const progressInterval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
              progress = 100;
              clearInterval(progressInterval);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileItem.id
                    ? { ...f, progress: 100, status: "ready" }
                    : f
                )
              );
            } else {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileItem.id ? { ...f, progress } : f
                )
              );
            }
          }, 200);

          // Upload to server
          try {
            const res = await apiRequest("POST", "/api/files", {
              sessionId,
              name: file.name,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
              data: data.substring(data.indexOf(",") + 1), // Remove data: url prefix
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`upload failed: ${res.status} ${text}`);
            }

            const uploadedFile = await res.json();
            
            // Update file with server ID
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      id: uploadedFile.file.id,
                      expiresAt: new Date(uploadedFile.file.expiresAt),
                    }
                  : f
              )
            );
          } catch (err) {
            console.error("File upload failed:", err);
            setFiles((prev) => prev.filter((f) => f.id !== fileItem.id));
            setError(err instanceof Error ? err.message : "File upload failed");
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [sessionId]
  );

  // Delete file
  const deleteFile = useCallback(
    async (fileId: string) => {
      try {
        await apiRequest("DELETE", `/api/files/${fileId}`);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    },
    []
  );

  // Send file to peer
  const sendFileToPeer = useCallback(
    async (fileId: string, peerId: string) => {
      if (!sessionId) return;

      try {
        const res = await apiRequest("POST", "/api/transfers", {
          fileId,
          senderPeerId: peerIdRef.current,
          receiverPeerId: peerId,
        });

        const transfer = await res.json();

        // Update file status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "sending" } : f
          )
        );

        // Notify via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "transfer-start",
              peerId: peerIdRef.current,
              sessionId,
              payload: {
                transferId: transfer.transfer.id,
                toPeerId: peerId,
                fileName: files.find((f) => f.id === fileId)?.name,
              },
            })
          );
        }

        // Simulate transfer completion
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: "sent" } : f
            )
          );
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "transfer-complete",
                peerId: peerIdRef.current,
                sessionId,
                payload: {
                  transferId: transfer.transfer.id,
                  success: true,
                },
              })
            );
          }
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Send failed");
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "ready" } : f
          )
        );
      }
    },
    [sessionId, files]
  );

  // Cleanup expired files periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      setFiles((prev) => {
        const now = Date.now();
        return prev.filter((f) => f.expiresAt.getTime() > now);
      });
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Auto-refresh peers
  useEffect(() => {
    if (!sessionId) return;
    
    fetchPeers();
    const interval = setInterval(fetchPeers, 5000);
    return () => clearInterval(interval);
  }, [sessionId, fetchPeers]);

  // Auto-refresh files
  useEffect(() => {
    if (!sessionId) return;
    
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [sessionId, fetchFiles]);

  // Change peer name
  const changePeerName = useCallback(
    async (newName: string) => {
      if (!currentPeerId) return;
      
      try {
        const res = await apiRequest("PATCH", `/api/peers/${currentPeerId}`, {
          name: newName,
        });
        
        if (res.ok) {
          const data = await res.json();
          setCurrentPeerName(data.peer.name);
          // Refresh peers to update the UI
          await fetchPeers();
        } else {
          setError("Failed to update peer name");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update peer name");
      }
    },
    [currentPeerId, fetchPeers]
  );

  return {
    sessionId,
    sessionToken,
    peers,
    files,
    transfers,
    isLoading,
    error,
    currentPeerId,
    currentPeerName,
    uploadFile,
    deleteFile,
    sendFileToPeer,
    changePeerName,
    fetchPeers,
    fetchFiles,
  };
}
