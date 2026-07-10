// Seeds Gemini as the active AI provider on first MongoDB container initialization.
// This script only runs when the MongoDB data volume is created for the first time.
// If the volume already exists, call the admin API manually:
//   PUT /ai/api/ai/admin/providers/GEMINI (with body), then
//   PUT /ai/api/ai/admin/providers/GEMINI/activate
db = db.getSiblingDB('ai_engine_db');
if (db.ai_provider_configs.countDocuments({ active: true }) === 0) {
  db.ai_provider_configs.insertOne({
    provider: 'GEMINI',
    apiKey: process.env.GEMINI_API_KEY || 'REPLACE_WITH_GEMINI_API_KEY',
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    active: true,
    updatedAt: new Date(),
  });
  print('Seeded Gemini as active AI provider.');
} else {
  print('Active provider already exists — skipping seed.');
}
