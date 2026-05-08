import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../../../');

config({ path: resolve(repoRoot, '.env') });
config({ path: resolve(repoRoot, '.env.local'), override: true });

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  });

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  INTERNAL_API_KEY: z.string().min(1, 'INTERNAL_API_KEY is required'),
  SETTINGS_ENCRYPTION_KEY: z.string().min(1, 'SETTINGS_ENCRYPTION_KEY is required'),
  DEBUG_BACKEND: booleanFromEnv.default(false),
});

// Module initialization check
const moduleInitTime = new Date().toISOString().split('T')[1].split('.')[0];
console.log(`\n📦 [${moduleInitTime}] Initializing API module...`);

let env: z.infer<typeof schema>;
try {
  env = schema.parse(process.env);
  console.log(`✓ [${moduleInitTime}] API module configuration validated`);
  if (process.env.DEBUG_BACKEND) {
    console.log(`  Port: ${env.PORT}, Host: ${env.HOST}`);
  }
} catch (error) {
  console.error(`❌ [${moduleInitTime}] API module initialization failed:`);
  if (error instanceof z.ZodError) {
    error.errors.forEach((e) => {
      console.error(`   ${e.path.join('.')}: ${e.message}`);
    });
  } else {
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}

export { env };
