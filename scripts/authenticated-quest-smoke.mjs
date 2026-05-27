import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');

function loadDotEnv(path) {
  try {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

loadDotEnv(envPath);

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD'
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const placeholders = new Set([
  'your_supabase_project_url',
  'your_supabase_anon_key',
  'your_test_user_email',
  'your_test_user_password'
]);

for (const key of required) {
  if (placeholders.has(process.env[key])) {
    console.error(`Replace placeholder env var before running smoke test: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const date = new Date();
const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const normalizeError = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return JSON.stringify(error);
};

async function run() {
  console.log('Signing in test user...');
  const signInResult = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD
  });
  ensure(!signInResult.error, `Sign-in failed: ${normalizeError(signInResult.error)}`);
  ensure(signInResult.data.user?.id, 'No authenticated user ID returned from sign-in');
  const userId = signInResult.data.user.id;
  console.log(`Signed in as user: ${userId}`);

  console.log('Loading daily quest templates...');
  const templatesResult = await supabase
    .from('quest_templates')
    .select('*')
    .eq('is_active', true)
    .eq('quest_type', 'daily')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  ensure(!templatesResult.error, `Template load failed: ${normalizeError(templatesResult.error)}`);
  const templates = templatesResult.data ?? [];
  ensure(templates.length > 0, 'No active daily templates found in quest_templates');
  console.log(`Loaded ${templates.length} daily template(s).`);

  const template = templates[0];
  const questId = `daily-${dateKey}-${template.template_key}`;

  console.log('Submitting first completion (expected success if not already completed today)...');
  const firstResult = await supabase.rpc('complete_quest', {
    p_user_id: userId,
    p_quest_id: questId,
    p_title: template.title,
    p_domain: template.domain,
    p_xp_reward: template.base_xp_reward,
    p_coin_reward: template.base_coin_reward
  });
  ensure(!firstResult.error, `First RPC call failed: ${normalizeError(firstResult.error)}`);
  ensure(firstResult.data && typeof firstResult.data.success === 'boolean', 'Invalid first RPC response payload');
  console.log(`First completion response: ${JSON.stringify(firstResult.data)}`);

  console.log('Submitting second completion for same daily template/date (expected rejection)...');
  const secondResult = await supabase.rpc('complete_quest', {
    p_user_id: userId,
    p_quest_id: questId,
    p_title: template.title,
    p_domain: template.domain,
    p_xp_reward: template.base_xp_reward,
    p_coin_reward: template.base_coin_reward
  });
  ensure(!secondResult.error, `Second RPC call failed: ${normalizeError(secondResult.error)}`);
  ensure(secondResult.data && secondResult.data.success === false, `Expected duplicate guard to reject second completion. Got: ${JSON.stringify(secondResult.data)}`);
  console.log(`Second completion response: ${JSON.stringify(secondResult.data)}`);

  console.log('Fetching persisted quest row...');
  const questRow = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .single();

  ensure(!questRow.error, `Failed to fetch persisted user_quests row: ${normalizeError(questRow.error)}`);
  ensure(questRow.data?.status === 'completed', `Expected persisted quest status=completed, got ${questRow.data?.status}`);
  console.log('Persisted quest row verified.');

  await supabase.auth.signOut();
  console.log('Authenticated quest smoke test passed.');
}

run().catch(async (error) => {
  try {
    await supabase.auth.signOut();
  } catch {
    // no-op
  }
  console.error(`Smoke test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
