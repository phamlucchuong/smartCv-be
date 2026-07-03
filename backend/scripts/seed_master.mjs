#!/usr/bin/env node
/**
 * Master data seeder for SmartCV databases.
 *
 * Seeds initial data required for services to operate. Run it once per
 * environment (fresh machine, docker compose, CI) after MongoDB is up:
 *
 *   cd backend/scripts && npm install        # first time only
 *   node seed_master.mjs                     # seed everything
 *   node seed_master.mjs --only ai           # seed one service
 *   node seed_master.mjs --dry-run           # show what would change
 *   node seed_master.mjs --activate gemini
 *
 * Connection and secrets are read from backend/.env (or --env-file).
 * Services load their config from the database at runtime; the AI engine
 * retries loading on first use, so seeding after service startup also works.
 */

import { randomUUID, createCipheriv, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { MongoClient } from "mongodb";

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Env handling
// ---------------------------------------------------------------------------

/** Minimal .env parser: KEY=VALUE lines, '#' comments, optional quotes. */
export function loadEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (let line of readFileSync(path, "utf8").split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    values[key] = value;
  }
  return values;
}

/** Process environment wins over .env file values. */
export class Env {
  constructor(fileValues) {
    this.fileValues = fileValues;
  }

  get(key, fallback = "") {
    return process.env[key] || this.fileValues[key] || fallback;
  }
}

/**
 * AES-256-GCM encryption matching vn.chuongpl.ai_engine_service.security.AiCredentialCipher
 * (backend/ai_engine_service): "v1:" + base64(iv) + ":" + base64(ciphertext||tag), tag
 * appended to ciphertext per Java's Cipher.doFinal() convention for GCM. Both write paths
 * (this script and the admin API) must produce values the Java service can decrypt.
 */
export function encryptCredential(plaintext, base64Key) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return plaintext;
  if (!base64Key) {
    throw new Error("APP_ENCRYPTION_KEY is not configured; cannot store AI provider credentials");
  }
  const key = Buffer.from(base64Key, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `v1:${iv.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function mongoUri(env) {
  const uri = env.get("MONGO_URI");
  if (uri) return uri;
  const host = env.get("MONGO_DB_HOST", "localhost");
  const port = env.get("MONGO_DB_PORT", "27017");
  const user = env.get("MONGO_DB_USERNAME", "admin");
  const password = env.get("MONGO_DB_PASSWORD", "password");
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/?authSource=admin`;
}

// ---------------------------------------------------------------------------
// AI engine service: ai_provider_configs
// ---------------------------------------------------------------------------

// Matches vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig
const AI_CONFIG_CLASS = "vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig";

// Provider -> env vars and defaults. Order defines activation priority.
const AI_PROVIDERS = {
  GROQ: {
    apiKey: "GROQ_API_KEY",
    baseUrl: ["GROQ_BASE_URL", "https://api.groq.com/openai/v1"],
    model: ["GROQ_DEFAULT_MODEL", "llama-3.3-70b-versatile"],
  },
  GEMINI: {
    apiKey: "GEMINI_API_KEY",
    baseUrl: ["GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"],
    model: ["GEMINI_DEFAULT_MODEL", "gemini-2.0-flash"],
  },
  AZURE_OPENAI: {
    apiKey: "AZURE_OPENAI_API_KEY",
    baseUrl: ["AZURE_OPENAI_ENDPOINT", null],
    model: ["AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini"],
    deploymentName: ["AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini"],
  },
};

function envValue(env, spec) {
  if (!spec) return null;
  const [key, fallback] = spec;
  return (key && env.get(key)) || fallback;
}

async function seedAiEngine(client, env, { activate, dryRun }) {
  const db = client.db(env.get("AI_MONGO_DB_NAME", "ai_engine_db"));
  const collection = db.collection("ai_provider_configs");
  const now = new Date();

  const encryptionKey = env.get("APP_ENCRYPTION_KEY");
  const configured = [];
  for (const [provider, spec] of Object.entries(AI_PROVIDERS)) {
    const apiKey = env.get(spec.apiKey);
    if (!apiKey) continue;
    configured.push(provider);
    const doc = {
      provider,
      apiKey: dryRun ? apiKey : encryptCredential(apiKey, encryptionKey),
      model: envValue(env, spec.model),
      baseUrl: envValue(env, spec.baseUrl),
      deploymentName: envValue(env, spec.deploymentName),
      updatedAt: now,
      _class: AI_CONFIG_CLASS,
    };
    for (const key of Object.keys(doc)) {
      if (doc[key] === null || doc[key] === undefined) delete doc[key];
    }
    if (dryRun) {
      console.log(`  [dry-run] upsert provider=${provider} model=${doc.model}`);
      continue;
    }
    // Convention: all SmartCV documents use String UUID _id, never ObjectId
    await collection.updateOne(
      { provider },
      { $set: doc, $setOnInsert: { _id: randomUUID(), active: false } },
      { upsert: true },
    );
    console.log(`  upserted provider=${provider} model=${doc.model}`);
  }

  if (configured.length === 0) {
    console.error("  no provider API keys found in env — nothing to seed");
    return;
  }

  const currentActive = await collection.findOne({ active: true });
  let target;
  if (activate) {
    target = activate.toUpperCase().replaceAll("-", "_");
    if (!configured.includes(target)) {
      throw new Error(`cannot activate ${target}: no API key configured for it`);
    }
  } else if (currentActive) {
    console.log(`  keeping current active provider: ${currentActive.provider}`);
    return;
  } else {
    target = configured[0];
  }

  if (dryRun) {
    console.log(`  [dry-run] would activate provider=${target}`);
    return;
  }
  await collection.updateMany(
    { provider: { $ne: target } },
    { $set: { active: false, updatedAt: now } },
  );
  await collection.updateOne({ provider: target }, { $set: { active: true, updatedAt: now } });
  console.log(`  activated provider=${target}`);
}

// ---------------------------------------------------------------------------
// Registry — add new service seeders here
// ---------------------------------------------------------------------------

const SEEDERS = {
  ai: seedAiEngine,
};

async function main() {
  const { values: args } = parseArgs({
    options: {
      only: { type: "string" },
      "env-file": { type: "string", default: resolve(BACKEND_DIR, ".env") },
      activate: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  if (args.only && !SEEDERS[args.only]) {
    throw new Error(`unknown service '${args.only}' — available: ${Object.keys(SEEDERS).join(", ")}`);
  }

  const env = new Env(loadEnvFile(args["env-file"]));
  const client = new MongoClient(mongoUri(env), { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const targets = args.only ? [args.only] : Object.keys(SEEDERS).sort();
    for (const name of targets) {
      console.log(`seeding: ${name}`);
      await SEEDERS[name](client, env, { activate: args.activate, dryRun: args["dry-run"] });
    }
    console.log("done");
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
