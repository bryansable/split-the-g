# Cloud setup (accounts, friends, daily contests)

The app code for accounts, friend invites and the daily leaderboard is already built. It just needs a Supabase project behind it. One-time, about five minutes, on a desktop browser.

## 1. Create the project

1. Go to https://supabase.com and sign in (GitHub login is fine).
2. **New project**. Name: `split-the-g`. Region: nearest you. Let it generate the database password (you will not need it).
3. Wait for the project to finish provisioning.

## 2. Create the tables

1. Left sidebar: **SQL Editor**, then **New query**.
2. Paste the whole of `supabase/schema.sql` from this repo and click **Run**. It creates `profiles`, `friendships` and `attempts` with row-level security, and a trigger that makes a profile for every new account.

## 3. Allow sign-in links back to the app

1. Left sidebar: **Authentication**, then **URL Configuration**.
2. Site URL: `https://bryansable.github.io/split-the-g/`
3. Redirect URLs: add the same address, and `http://localhost:5173/split-the-g/` for local development.

Sign-in is a passwordless magic link by email, which is on by default.

## 4. Give the app the keys

Left sidebar: **Project Settings**, then **API**. You need two values:

- **Project URL**, like `https://abcdefgh.supabase.co`
- **anon public** key (the long `eyJ...` string). This key is designed to be shipped in a browser app; row-level security protects the data.

Put them in the GitHub repo so the deploy can use them (repo **Settings**, **Secrets and variables**, **Actions**, **New repository secret**):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then re-run the latest **Deploy to GitHub Pages** workflow from the Actions tab, or push any commit.

For local development, copy `.env.example` to `.env` and paste the same two values.

## 5. Try it

1. Open the app, tap **Sign in**, enter your email, tap the link in the email on the same phone.
2. **Profile**: pick a username.
3. **Friends**: share your invite link. A friend who opens it, signs in and picks a username sends you a request; accept it.
4. Both score a pint. **Contest** shows today's leaderboard, best score per person, resetting at midnight.
