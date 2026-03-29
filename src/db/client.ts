import Database from "better-sqlite3";
import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

let sqlite: Database.Database | null = null;
let orm: BetterSQLite3Database<typeof schema> | null = null;

export function initDb(dbFile: string) {
    if (sqlite && orm) {
        return { sqlite, db: orm };
    }

    const dbPath = path.resolve(process.cwd(), dbFile);
    sqlite = new Database(dbPath);
    orm = drizzle(sqlite, { schema });

    return { sqlite, db: orm };
}

export function getDb(dbFile: string) {
    if (!sqlite || !orm) {
        return initDb(dbFile);
    }

    return { sqlite, db: orm };
}

export function closeDb() {
    if (sqlite) {
        sqlite.close();
        sqlite = null;
        orm = null;
    }
}
