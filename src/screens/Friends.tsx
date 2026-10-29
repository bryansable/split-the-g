import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Input, LinkButton, Notice, PageTitle } from '../components/ui'
import { useAuth } from '../data/AuthContext'
import { acceptFriendRequest, listFriendships, removeFriendship, sendFriendRequest } from '../data/supabase'
import type { Friendship } from '../data/types'
import { APP_URL } from '../share/shareCard'

export function Friends() {
  const { cloudEnabled, session, profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Friendship[]>([])
  const [username, setUsername] = useState(params.get('add') ?? '')
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null)
  const [busy, setBusy] = useState(false)

  const myId = session?.user.id

  const refresh = useCallback(async () => {
    if (!myId) return
    try {
      setRows(await listFriendships(myId))
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'warn' })
    }
  }, [myId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function add(name = username) {
    if (!myId || !name.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await sendFriendRequest(myId, name)
      setMsg({ text: `Request sent to @${name.trim().toLowerCase()}`, tone: 'ok' })
      setUsername('')
      if (params.has('add')) setParams({})
      await refresh()
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  // Arrived via an invite link while signed in: send the request automatically.
  useEffect(() => {
    const target = params.get('add')
    if (target && myId && profile?.username) void add(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, myId, profile?.username])

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <div className="p-4 space-y-4">
        <PageTitle>Friends</PageTitle>
        <Notice tone="warn">Friends and contests need the cloud backend, which is not configured in this build. See the README to set up Supabase.</Notice>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-4 space-y-4">
        <PageTitle>Friends</PageTitle>
        <Card className="text-center space-y-3">
          <p className="text-cream/70">Sign in to add friends and join daily contests.</p>
          <LinkButton to="/profile">Sign in</LinkButton>
        </Card>
      </div>
    )
  }

  if (!profile?.username) {
    return (
      <div className="p-4 space-y-4">
        <PageTitle>Friends</PageTitle>
        <Card className="text-center space-y-3">
          <p className="text-cream/70">Pick a username first so friends can find you.</p>
          <LinkButton to="/profile">Choose username</LinkButton>
        </Card>
      </div>
    )
  }

  const incoming = rows.filter((r) => r.status === 'pending' && r.addresseeId === myId)
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requesterId === myId)
  const friends = rows.filter((r) => r.status === 'accepted')
  const inviteUrl = `${APP_URL}#/friends?add=${profile.username}`

  async function shareInvite() {
    const text = `Add me on Split The G: @${profile!.username} ${inviteUrl}`
    try {
      if (navigator.share) await navigator.share({ text, url: inviteUrl })
      else {
        await navigator.clipboard.writeText(inviteUrl)
        setMsg({ text: 'Invite link copied', tone: 'ok' })
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="p-4 space-y-4">
      <PageTitle sub={`You are @${profile.username}`}>Friends</PageTitle>

      <Card className="space-y-2">
        <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em]">Add a friend</div>
        <div className="flex gap-2">
          <Input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <Button onClick={() => add()} disabled={busy || !username.trim()}>
            Add
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={shareInvite}>
          Share my invite link
        </Button>
      </Card>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {incoming.length > 0 && (
        <Card className="space-y-2">
          <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em]">Requests</div>
          {incoming.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className="text-cream">@{r.other?.username ?? 'someone'}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => act(() => acceptFriendRequest(r.id))}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em]">Friends ({friends.length})</div>
        {friends.length === 0 && <p className="text-cream/50 text-sm">No friends yet. Share your invite link.</p>}
        {friends.map((r) => (
          <div key={r.id} className="flex items-center justify-between">
            <span className="text-cream">@{r.other?.username ?? 'anon'}</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
              Remove
            </Button>
          </div>
        ))}
        {outgoing.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-cream/50 text-sm">
            <span>@{r.other?.username ?? 'anon'} · pending</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
              Cancel
            </Button>
          </div>
        ))}
      </Card>
    </div>
  )
}
