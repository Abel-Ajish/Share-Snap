import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const pool = connectionString
    ? new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    })
    : null;

export const db = pool
    ? drizzle(pool, { schema })
    : null as any; // Cast to any because we'll check availability in DatabaseStorage
