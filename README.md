# Split The G

Take one sip of your pint and land the beer line dead on the G. This app scores how close you got, using your phone camera, with **any** beer glass: it shows a ghost G exactly where the G sits on the classic tulip pint glass.

- Live camera scoring with automatic beer-line detection (drag to correct it)
- Works on iPhone and Android as an installable web app (PWA), no app store
- Score history with a chart, best, average and streak
- Friends, invite links and a daily "G-off" leaderboard (Supabase)
- Share a result card to any app

Independent fan project. Not affiliated with or endorsed by any brewery.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL. The camera needs HTTPS or `localhost`; on a desktop use **Pick photo** to score a photo of a glass instead.

```bash
npm test        # scoring engine tests
npm run build   # type-check + production build into dist/
```

## Deploy (GitHub Pages)

1. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and deploys.
2. In the repo: **Settings → Pages → Source: GitHub Actions** (one time).
3. The app is served at **https://pintsplit.com/**. The custom domain is set in the repo's Pages settings and in `public/CNAME`; `APP_URL` in `src/share/shareCard.ts` must match.

DNS for `pintsplit.com` lives in Cloudflare and points at GitHub Pages (records set to DNS only, not proxied, so GitHub can issue the certificate):

| Type  | Name | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| CNAME | www  | bryansable.github.io |

To serve from a github.io project path instead, build with `VITE_BASE=/split-the-g/` and remove `public/CNAME`.

## Cloud features (friends + contests)

Without keys the app runs local-only: scoring and history work, Friends and Contest explain that the cloud is off.

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run `supabase/schema.sql`.
3. In **Authentication → URL Configuration** set the Site URL to your Pages URL (e.g. `https://pintsplit.com/`) and add it to Redirect URLs. Add `http://localhost:5173/` too for local dev.
4. Copy **Project URL** and **anon public key** from Settings → API:
   - locally: `cp .env.example .env` and fill them in
   - on GitHub: repo **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy workflow.

Sign-in is a passwordless magic link by email. Attempts recorded while signed out sync up on first sign-in.

## How scoring works

Everything is measured as a fraction of the glass height between the rim and the base, so glass size and distance do not matter. Readings are taken at the front of the glass, where the G is printed.

- Framing: `src/engine/frame.ts` finds the glass automatically. It tracks the two side walls as vertical edges, takes the rim and base from where they end, then refines the rim to the near arc of its ellipse and the base to the bottom edge of the foot. The RIM and BASE handles on screen are only for correcting it.
- Target: `TARGET_FRACTION = 0.30` (30% of the way down from the rim) in `src/engine/glass.ts`, the centre of the G on the official tulip glass. A band of ±2% around it is the G's bar.
- Detection: `src/engine/detect.ts` scores each row of a column through the middle of the glass for foam-over-beer steps, the reverse, and thin dark meniscus lines; three strips across the column must agree. The reported line is the near (bottom) edge of the meniscus band. The search stops 75% of the way down so the foot of the glass cannot win.
- Score: 100 inside the band, then 6 points off per percent of glass height outside it. 100 = Split, 85+ = So close, 60+ = Decent, below = Rookie.

Real-photo regression tests live in `src/engine/fixtures.test.ts` and read PNGs from a gitignored `fixtures/` folder; they skip when the files are absent.

If you measure your own glass and the G sits elsewhere, change `TARGET_FRACTION`; nothing else hard-codes it.

## Project layout

```
src/engine     pure scoring maths + tests (glass geometry, detection, score, cover mapping)
src/camera     camera hook, SVG overlay with draggable guides, frame sampler
src/screens    Home, Score, Result, History, Friends, Contest, Profile
src/data       local store (localStorage), Supabase client, auth context, sync
src/share      share-card renderer and Web Share fallback chain
supabase/      database schema + RLS policies
scripts/       icon generator (no image deps)
```
