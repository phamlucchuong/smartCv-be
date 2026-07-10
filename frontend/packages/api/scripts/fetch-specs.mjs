import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../openapi/live');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function normalizeSecuritySchemes(document) {
  const securitySchemes = document?.components?.securitySchemes;
  if (!securitySchemes || typeof securitySchemes !== 'object') {
    return document;
  }

  for (const scheme of Object.values(securitySchemes)) {
    if (!scheme || typeof scheme !== 'object') {
      continue;
    }

    // Springdoc currently emits `name` for HTTP bearer auth in some services.
    // That property is invalid for `type: http` and trips Orval validation.
    if (scheme.type === 'http') {
      delete scheme.name;
    }
  }

  return document;
}

function isBinaryUploadSchema(schema) {
  if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
    return false;
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') {
    return false;
  }

  return Object.values(properties).some(
    (property) =>
      property &&
      typeof property === 'object' &&
      property.type === 'string' &&
      property.format === 'binary',
  );
}

function normalizeMultipartRequestBodies(document) {
  const paths = document?.paths;
  if (!paths || typeof paths !== 'object') {
    return document;
  }

  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      const requestBody = operation?.requestBody;
      const jsonBody = requestBody?.content?.['application/json'];
      const multipartBody = requestBody?.content?.['multipart/form-data'];

      if (!jsonBody || multipartBody) {
        continue;
      }

      if (isBinaryUploadSchema(jsonBody.schema)) {
        requestBody.content = {
          'multipart/form-data': jsonBody,
        };
      }
    }
  }

  return document;
}

function normalizeSpecFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = normalizeMultipartRequestBodies(normalizeSecuritySchemes(parsed));
  fs.writeFileSync(file, `${JSON.stringify(normalized)}\n`);
}

const SPECS = [
  {
    name: 'user-service',
    url: process.env.USER_SERVICE_URL ?? 'http://localhost:8081/user/v3/api-docs',
    out: path.join(OUTPUT_DIR, 'user-service.json'),
  },
  {
    name: 'job-service',
    url: process.env.JOB_SERVICE_URL ?? 'http://localhost:8082/job/v3/api-docs',
    out: path.join(OUTPUT_DIR, 'job-service.json'),
  },
  {
    name: 'application-service',
    url: process.env.APP_SERVICE_URL ?? 'http://localhost:8083/application/v3/api-docs',
    out: path.join(OUTPUT_DIR, 'application-service.json'),
  },
  {
    name: 'ai-service',
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:8085/ai/v3/api-docs',
    out: path.join(OUTPUT_DIR, 'ai-service.json'),
  },
];

let missingSpec = false;

for (const spec of SPECS) {
  process.stdout.write(`Fetching ${spec.name} ... `);
  try {
    execFileSync('curl', ['-sf', '--max-time', '10', spec.url, '-o', spec.out]);
    normalizeSpecFile(spec.out);
    console.log(`saved -> ${path.relative(process.cwd(), spec.out)}`);
  } catch {
    if (fs.existsSync(spec.out)) {
      normalizeSpecFile(spec.out);
      console.warn(`SKIPPED (service unreachable, using cached spec)`);
    } else {
      console.error(`FAILED (is ${spec.url} reachable? No cached spec available)`);
      missingSpec = true;
    }
  }
}

if (missingSpec) {
  console.error('\nSome specs have no cache. Start the missing services and run again.');
  process.exit(1);
}
