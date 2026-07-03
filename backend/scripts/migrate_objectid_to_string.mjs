#!/usr/bin/env node
/**
 * One-off migration: convert ObjectId _id documents to String _id.
 *
 * SmartCV convention is String UUID _id everywhere; a few documents were
 * created with auto-generated ObjectId _id (AI engine collections, manually
 * inserted test data). This rewrites each such document keeping the same id
 * value as its 24-char hex string, so any external references stay valid.
 *
 *   node migrate_objectid_to_string.mjs --dry-run
 *   node migrate_objectid_to_string.mjs
 *
 * Safe to re-run: already-converted documents are skipped. Mongock's own
 * collections (mongockChangeLog/mongockLock) are left untouched.
 */

import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { loadEnvFile, Env, mongoUri } from "./seed_master.mjs";

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MONGOCK_COLLECTIONS = new Set(["mongockChangeLog", "mongockLock"]);

async function migrateCollection(db, name, dryRun) {
  const collection = db.collection(name);
  const cursor = collection.find({ _id: { $type: "objectId" } });
  let migrated = 0;
  for await (const doc of cursor) {
    const hexId = doc._id.toHexString();
    if (dryRun) {
      console.log(`  [dry-run] ${db.databaseName}.${name}: ${hexId} → string`);
      migrated++;
      continue;
    }
    const existing = await collection.findOne({ _id: hexId });
    if (!existing) {
      await collection.insertOne({ ...doc, _id: hexId });
    }
    await collection.deleteOne({ _id: doc._id });
    console.log(`  migrated ${db.databaseName}.${name}: ${hexId}`);
    migrated++;
  }
  return migrated;
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      "env-file": { type: "string", default: resolve(BACKEND_DIR, ".env") },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const env = new Env(loadEnvFile(args["env-file"]));
  const client = new MongoClient(mongoUri(env), { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const dbNames = (await client.db().admin().listDatabases()).databases
      .map((d) => d.name)
      .filter((n) => !["admin", "local", "config"].includes(n));

    let total = 0;
    for (const dbName of dbNames) {
      const db = client.db(dbName);
      for (const info of await db.listCollections().toArray()) {
        if (MONGOCK_COLLECTIONS.has(info.name)) continue;
        total += await migrateCollection(db, info.name, args["dry-run"]);
      }
    }
    console.log(`${args["dry-run"] ? "[dry-run] would migrate" : "migrated"} ${total} document(s)`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
