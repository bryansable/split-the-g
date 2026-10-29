# Cloud backend (accounts, friends, daily contests)

The backend is a Supabase project named `split-the-g` (reference `cklyoxozsdzfrmeafjyk`) in Bryan's Supabase organization. This file records how it is set up so it can be rebuilt.

## What exists

- **Tables and policies** from `supabase/schema.sql`: `profiles`, `friendships`, `attempts`, row-level security, and a trigger that creates a profile for every new account. Re-run the file in the SQL Editor after changing it; it is idempotent.
- **Auth**: passwordless magic link by email (the default). Site URL `https://pintsplit.com/`; redirect URLs `https://pintsplit.com/**` and `http://localhost:5173/**`.
- **Keys**: the project URL and the *publishable* key are committed in `.env.production` and picked up by the GitHub Pages build. They are designed to be public; RLS protects the data. The *secret* key is never used by the app and must stay out of the repo.

## Rotating the publishable key

Settings, API Keys, create a new publishable key, update `.env.production`, push. Then delete the old key.

## Local development

Copy `.env.example` to `.env` with the same two values, then `npm run dev`. Magic links sent from a local session redirect to `http://localhost:5173/`.

## Trying it

1. Open the app, tap **Sign in**, enter your email, tap the link in the email on the same phone.
2. **Profile**: pick a username.
3. **Friends**: share your invite link. A friend who opens it, signs in and picks a username sends you a request; accept it.
4. Both score a pint. **Contest** shows today's leaderboard, best score per person, resetting at midnight.
