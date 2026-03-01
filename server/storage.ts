import { db } from "./db.js";
import { eq, and, lte } from "drizzle-orm";
import {
  users, sessions, files, transfers, peers,
  type User, type InsertUser,
  type Session, type InsertSession,
  type File, type InsertFile,
  type Transfer, type InsertTransfer,
  type Peer, type InsertPeer
} from "../shared/schema.js";
import { randomUUID } from "crypto";

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
  getTransfersByReceiver(receiverPeerId: string): Promise<Transfer[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  updateTransfer(id: string, update: Partial<Transfer>): Promise<Transfer>;

  // Peer methods
  getPeer(id: string): Promise<Peer | undefined>;
  getPeersBySession(sessionId: string): Promise<Peer[]>;
  createPeer(peer: InsertPeer): Promise<Peer>;
  updatePeer(id: string, update: Partial<Peer>): Promise<Peer>;
  deletePeer(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    return undefined;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async getFilesBySession(sessionId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.sessionId, sessionId));
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(insertFile).returning();
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async deleteExpiredFiles(): Promise<void> {
    await db.delete(files).where(lte(files.expiresAt, new Date()));
  }

  async getTransfer(id: string): Promise<Transfer | undefined> {
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    return transfer;
  }

  async getTransfersByFile(fileId: string): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.fileId, fileId));
  }

  async getTransfersByReceiver(receiverPeerId: string): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.receiverPeerId, receiverPeerId));
  }

  async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
    const [transfer] = await db.insert(transfers).values(insertTransfer).returning();
    return transfer;
  }

  async updateTransfer(id: string, update: Partial<Transfer>): Promise<Transfer> {
    const [updated] = await db.update(transfers).set(update).where(eq(transfers.id, id)).returning();
    return updated;
  }

  async getPeer(id: string): Promise<Peer | undefined> {
    const [peer] = await db.select().from(peers).where(eq(peers.id, id));
    return peer;
  }

  async getPeersBySession(sessionId: string): Promise<Peer[]> {
    return await db.select().from(peers).where(eq(peers.sessionId, sessionId));
  }

  async createPeer(insertPeer: InsertPeer): Promise<Peer> {
    const [peer] = await db.insert(peers).values(insertPeer).returning();
    return peer;
  }

  async updatePeer(id: string, update: Partial<Peer>): Promise<Peer> {
    const [updated] = await db.update(peers).set({ ...update, lastSeen: new Date() }).where(eq(peers.id, id)).returning();
    return updated;
  }

  async deletePeer(id: string): Promise<void> {
    await db.delete(peers).where(eq(peers.id, id));
  }
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

  async getSession(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    return undefined;
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

  async getTransfer(id: string): Promise<Transfer | undefined> {
    return this.transfers.get(id);
  }

  async getTransfersByFile(fileId: string): Promise<Transfer[]> {
    return Array.from(this.transfers.values()).filter(t => t.fileId === fileId);
  }

  async getTransfersByReceiver(receiverPeerId: string): Promise<Transfer[]> {
    return Array.from(this.transfers.values()).filter(t => t.receiverPeerId === receiverPeerId);
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

export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
