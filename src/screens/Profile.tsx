import { useState } from 'react'
import { Button, Card, Input, Notice, PageTitle } from '../components/ui'
import { useAuth } from '../data/AuthContext'
import { useAttempts } from '../data/local'
import { setUsername as saveUsername, signInWithEmail, signOut } from '../data/supabase'
import { GLASS_HEIGHT_MM, TARGET_FRACTION } from '../engine/glass'

export function Profile() {
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
    <div className="p-4 space-y-4">
      <PageTitle>Profile</PageTitle>

      {!cloudEnabled ? (
        <Notice tone="warn">
          This build has no cloud backend, so there is nothing to sign in to. Your {attempts.length} attempt{attempts.length === 1 ? '' : 's'} stay
          on this device.
        </Notice>
      ) : loading ? (
        <p className="text-cream/50">Loading…</p>
      ) : !session ? (
        <Card className="space-y-3">
          <div className="text-cream font-semibold">Sign in with a magic link</div>
          <p className="text-cream/60 text-sm">No password. We email you a link; tap it on this device.</p>
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
            Send link
          </Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="text-cream/60 text-xs uppercase tracking-wider">Signed in as</div>
            <div className="text-cream">{session.user.email}</div>
            <div className="text-cream/60 text-xs uppercase tracking-wider pt-2">Username</div>
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
            <p className="text-cream/40 text-xs">3-20 lowercase letters, numbers or underscores. Friends add you by this name.</p>
          </Card>
          <Button variant="danger" onClick={() => run(() => signOut())} disabled={busy}>
            Sign out
          </Button>
        </>
      )}

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card className="text-xs text-cream/50 leading-relaxed space-y-1">
        <div className="text-cream/70 font-semibold">About the scoring</div>
        <p>
          The target line sits {Math.round(TARGET_FRACTION * 100)}% of the way down the glass (about {Math.round(TARGET_FRACTION * GLASS_HEIGHT_MM)} mm
          from the rim on a standard pint), which is where the middle of the G sits on the classic tulip glass. Inside the G bar you score 100;
          each percent of glass height outside it costs 6 points.
        </p>
        <p>Split The G is an independent fan project and is not affiliated with or endorsed by any brewery.</p>
      </Card>
    </div>
  )
}
