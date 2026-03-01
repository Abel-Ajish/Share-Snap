import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

export const pool = process.env.DATABASE_URL
    ? new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    : null;

export const db = pool
    ? drizzle(pool, { schema })
    : null as any; // Cast to any because we'll check availability in DatabaseStorage
