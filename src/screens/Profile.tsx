import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Hr, Input, Notice, Page, PageTitle, SectionLabel } from '../components/ui'
import { useAuth } from '../data/AuthContext'
import { setMode, useMode } from '../data/mode'
import { useAttempts } from '../data/local'
import { setUsername as saveUsername, signInWithEmail, signOut } from '../data/supabase'
import { GLASS_HEIGHT_MM, TARGET_FRACTION } from '../engine/glass'

export function Profile() {
  const mode = useMode()
  const { cloudEnabled, session, profile, refreshProfile, loading } = useAuth()
  const attempts = useAttempts()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<string | void>) {
    setBusy(true)
    setMsg(null)
    try {
      const text = await fn()
      if (text) setMsg({ text, tone: 'ok' })
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageTitle>{cloudEnabled ? 'Profile' : 'About'}</PageTitle>

      {!cloudEnabled ? (
        <p className="text-sm text-cream/60">
          {attempts.length} attempt{attempts.length === 1 ? '' : 's'} scored on this phone.
        </p>
      ) : loading ? (
        <p className="text-cream/50">Loading…</p>
      ) : !session ? (
        <>
          <SectionLabel>Sign in with a magic link</SectionLabel>
          <p className="text-cream/60 text-sm mb-3">No password. We email you a link; tap it on this device.</p>
          <div className="flex gap-2">
            <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button
              disabled={busy || !email.includes('@')}
              onClick={() =>
                run(async () => {
                  await signInWithEmail(email.trim())
                  return 'Check your email for the sign-in link.'
                })
              }
            >
              Send
            </Button>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>Signed in as</SectionLabel>
          <div className="text-cream">{session.user.email}</div>

          <Hr className="mt-5" />
          <div className="pt-4">
            <SectionLabel>Username</SectionLabel>
          </div>
          <div className="flex gap-2">
            <Input placeholder="e.g. bryan_g" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" />
            <Button
              disabled={busy || !username.trim() || username.trim().toLowerCase() === profile?.username}
              onClick={() =>
                run(async () => {
                  await saveUsername(session.user.id, username)
                  await refreshProfile()
                  return 'Username saved.'
                })
              }
            >
              Save
            </Button>
          </div>
          <p className="mt-2 text-cream/40 text-xs">3-20 lowercase letters, numbers or underscores. Friends add you by this name.</p>

          <Hr className="mt-5" />
          <div className="pt-4">
            <Button variant="danger" size="sm" onClick={() => run(() => signOut())} disabled={busy}>
              Sign out
            </Button>
          </div>
        </>
      )}

      {msg && (
        <div className="mt-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}

      <Hr className="mt-6" />
      <div className="pt-4">
        <SectionLabel>Edition</SectionLabel>
        <div className="flex rounded-md border border-gold/40 overflow-hidden text-sm">
          <button
            className={`flex-1 py-2.5 font-display uppercase tracking-wide text-[0.8em] ${mode === 'pub' ? 'bg-gold text-ink' : 'text-cream/70'}`}
            onClick={() => setMode('pub')}
          >
            Pub
          </button>
          <button
            className={`flex-1 py-2.5 font-display uppercase tracking-wide text-[0.8em] ${mode === 'sparkling' ? 'bg-gold text-ink' : 'text-cream/70'}`}
            onClick={() => setMode('sparkling')}
          >
            Sparkling
          </button>
        </div>
        <p className="mt-2 text-cream/45 text-xs">
          {mode === 'pub'
            ? 'Beer, gold on stout. Adults only.'
            : 'Sparkling water, ice blue. Same G, same scoring, no beer. Of legal drinking age now? Choose Pub and answer the age question.'}
        </p>
      </div>

      <Hr className="mt-6" />
      <div className="pt-4 text-xs text-cream/50 leading-relaxed space-y-2">
        <SectionLabel>About the scoring</SectionLabel>
        <p>
          The target line sits {Math.round(TARGET_FRACTION * 100)}% of the way down the glass (about {Math.round(TARGET_FRACTION * GLASS_HEIGHT_MM)} mm
          from the rim on a standard pint), which is where the middle of the G sits on the classic tulip glass. Inside the G bar you score 100; each
          percent of glass height outside it costs 6 points. The glass is framed automatically and the level is read at the front of the glass.
        </p>
        <p>Split The G is an independent fan project and is not affiliated with or endorsed by any brewery.</p>
        <p className="pt-2 flex gap-4">
          <Link to="/how-to-play" className="text-gold underline-offset-4 hover:underline">
            How to play
          </Link>
          <a href="/blog" className="text-gold underline-offset-4 hover:underline">
            Blog
          </a>
          <a href="/about" className="text-gold underline-offset-4 hover:underline">
            About
          </a>
          <a href="/privacy" className="text-gold underline-offset-4 hover:underline">
            Privacy
          </a>
        </p>
      </div>
    </Page>
  )
}
