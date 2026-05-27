# Supabase setup

This app expects Supabase credentials in `.env`:

```dotenv
VITE_SUPABASE_URL=https://dtcsetbxtppfymsczpqo.supabase.co
VITE_SUPABASE_ANON_KEY=<project anon key>
VITE_ENABLED_OAUTH_PROVIDERS=
```

## Apply database migrations

Run every SQL file in `supabase/migrations` in filename order against the Supabase project.

With the Supabase CLI:

```bash
supabase login
supabase link --project-ref dtcsetbxtppfymsczpqo
supabase db push
```

Without the CLI, open the Supabase Dashboard SQL editor and run the migration files in order.

## Auth settings

In Supabase Dashboard > Authentication > URL Configuration:

- Site URL for local development: `http://localhost:5173`
- Redirect URLs:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/auth/reset-password`

Add the equivalent production URLs before deploying.

## OAuth providers

The auth page has buttons for Google, GitHub, Facebook, and Twitter. For each button you want enabled end to end, configure the matching provider in Supabase Dashboard > Authentication > Providers.

Each provider needs its own OAuth app/client in that provider's developer console. Use this Supabase callback URL in the provider console:

```text
https://dtcsetbxtppfymsczpqo.supabase.co/auth/v1/callback
```

Then paste the provider client ID and secret into Supabase and enable the provider. The local app redirects users to:

```text
http://127.0.0.1:5173/auth/callback
```

so that URL also needs to stay allowed in Supabase URL Configuration while developing locally.

After a provider is enabled in Supabase, add it to `.env` and restart the Vite dev server:

```dotenv
VITE_ENABLED_OAUTH_PROVIDERS=google,github
```

Supported values are `google`, `github`, `facebook`, and `twitter`.

## Smoke test

Set a real test user in `.env`:

```dotenv
TEST_USER_EMAIL=<existing test user email>
TEST_USER_PASSWORD=<existing test user password>
```

Then run:

```bash
npm run smoke:auth-quests
```

The smoke test signs in, loads daily quest templates, completes one daily quest, verifies the duplicate-completion guard, and checks that the completed quest row persisted.
