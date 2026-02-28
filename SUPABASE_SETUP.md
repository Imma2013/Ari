# Supabase + Google OAuth Setup

## 1) Environment
Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

For Vercel, set the same variables in Project Settings.

## 2) Google OAuth Provider
In Supabase Dashboard:
1. Go to `Authentication -> Providers -> Google`.
2. Enable Google provider.
3. Add your Google client ID/secret.
4. Add redirect URL:
   - Local: `http://localhost:3000/auth/callback`
   - Prod: `https://<your-vercel-domain>/auth/callback`

## 3) Database Migration (T4 Supabase CLI)
From project root:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

This applies:
- `profiles`
- `search_sessions`
- `search_messages`
- strict RLS policies

## 4) Sign-in Route
Use:
- `/auth/sign-in` to start Google login
- `/auth/callback` for OAuth exchange

