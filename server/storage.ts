import { 
  type User, 
  type InsertUser,
  type Session,
  type InsertSession,
  type File,
  type InsertFile,
  type Transfer,
  type InsertTransfer,
  type Peer,
  type InsertPeer
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Session methods
  getSession(id: string): Promise<Session | undefined>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: string): Promise<void>;

  // File methods
  getFile(id: string): Promise<File | undefined>;
  getFilesBySession(sessionId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  deleteFile(id: string): Promise<void>;
  deleteExpiredFiles(): Promise<void>;

  // Transfer methods
  getTransfer(id: string): Promise<Transfer | undefined>;
  getTransfersByFile(fileId: string): Promise<Transfer[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  updateTransfer(id: string, update: Partial<Transfer>): Promise<Transfer>;

  // Peer methods
  getPeer(id: string): Promise<Peer | undefined>;
  getPeersBySession(sessionId: string): Promise<Peer[]>;
  createPeer(peer: InsertPeer): Promise<Peer>;
  updatePeer(id: string, update: Partial<Peer>): Promise<Peer>;
  deletePeer(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, Session>;
  private files: Map<string, File>;
  private transfers: Map<string, Transfer>;
  private peers: Map<string, Peer>;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.files = new Map();
    this.transfers = new Map();
    this.peers = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Session methods
  async getSession(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    return undefined; // Return undefined if session is expired or not found
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.token === token);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    // Also delete associated files, transfers, and peers
    const filesToDelete = Array.from(this.files.values())
      .filter(f => f.sessionId === id)
      .map(f => f.id);
    
    for (const fileId of filesToDelete) {
      await this.deleteFile(fileId);
    }

    const peersToDelete = Array.from(this.peers.values())
      .filter(p => p.sessionId === id)
      .map(p => p.id);
    
    for (const peerId of peersToDelete) {
      await this.deletePeer(peerId);
    }
  }

  // File methods
  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesBySession(sessionId: string): Promise<File[]> {
    return Array.from(this.files.values()).filter(f => f.sessionId === sessionId);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = {
      ...insertFile,
      id,
      createdAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
    // Also delete associated transfers
    const transfersToDelete = Array.from(this.transfers.values())
      .filter(t => t.fileId === id)
      .map(t => t.id);
    
    for (const transferId of transfersToDelete) {
      this.transfers.delete(transferId);
    }
  }

  async deleteExpiredFiles(): Promise<void> {
    const now = new Date();
    const expiredFileIds = Array.from(this.files.entries())
      .filter(([_, file]) => file.expiresAt < now)
      .map(([id, _]) => id);
    
    for (const fileId of expiredFileIds) {
      await this.deleteFile(fileId);
    }
  }

  // Transfer methods
  async getTransfer(id: string): Promise<Transfer | undefined> {
    return this.transfers.get(id);
  }

  async getTransfersByFile(fileId: string): Promise<Transfer[]> {
    return Array.from(this.transfers.values()).filter(t => t.fileId === fileId);
  }

  async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
    const id = randomUUID();
    const transfer: Transfer = {
      ...insertTransfer,
      status: insertTransfer.status || "pending",
      progress: insertTransfer.progress || 0,
      id,
      createdAt: new Date(),
    };
    this.transfers.set(id, transfer);
    return transfer;
  }

  async updateTransfer(id: string, update: Partial<Transfer>): Promise<Transfer> {
    const transfer = this.transfers.get(id);
    if (!transfer) {
      throw new Error("Transfer not found");
    }
    
    const updated = { ...transfer, ...update };
    this.transfers.set(id, updated);
    return updated;
  }

  // Peer methods
  async getPeer(id: string): Promise<Peer | undefined> {
    return this.peers.get(id);
  }

  async getPeersBySession(sessionId: string): Promise<Peer[]> {
    return Array.from(this.peers.values()).filter(p => p.sessionId === sessionId);
  }

  async createPeer(insertPeer: InsertPeer): Promise<Peer> {
    const id = randomUUID();
    const peer: Peer = {
      ...insertPeer,
      id,
      createdAt: new Date(),
      lastSeen: new Date(),
      isOnline: true,
    };
    this.peers.set(id, peer);
    return peer;
  }

  async updatePeer(id: string, update: Partial<Peer>): Promise<Peer> {
    const peer = this.peers.get(id);
    if (!peer) {
      throw new Error("Peer not found");
    }
    
    const updated = { ...peer, ...update, lastSeen: new Date() };
    this.peers.set(id, updated);
    return updated;
  }

  async deletePeer(id: string): Promise<void> {
    this.peers.delete(id);
  }
}

export const storage = new MemStorage();
