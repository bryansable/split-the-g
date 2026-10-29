import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Hr, Input, LinkButton, Notice, Page, PageTitle, SectionLabel } from '../components/ui'
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

  if (!cloudEnabled || !session) {
    return (
      <Page>
        <PageTitle>Friends</PageTitle>
        <div className="py-6 text-center">
          <p className="text-cream/60 mb-4">Sign in to add friends and join daily contests.</p>
          <LinkButton to="/profile">Sign in</LinkButton>
        </div>
      </Page>
    )
  }

  if (!profile?.username) {
    return (
      <Page>
        <PageTitle>Friends</PageTitle>
        <div className="py-6 text-center">
          <p className="text-cream/60 mb-4">Pick a username first so friends can find you.</p>
          <LinkButton to="/profile">Choose username</LinkButton>
        </div>
      </Page>
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
    <Page>
      <PageTitle sub={`You are @${profile.username}`}>Friends</PageTitle>

      <SectionLabel>Add a friend</SectionLabel>
      <div className="flex gap-2">
        <Input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" />
        <Button onClick={() => add()} disabled={busy || !username.trim()}>
          Add
        </Button>
      </div>
      <button className="mt-3 text-sm text-gold underline-offset-4 hover:underline" onClick={shareInvite}>
        Share my invite link
      </button>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <Hr className="mt-6" />
          <div className="pt-4">
            <SectionLabel>Requests</SectionLabel>
          </div>
          <ul className="divide-y divide-gold/15">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="text-cream">@{r.other?.username ?? 'someone'}</span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(() => acceptFriendRequest(r.id))}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Hr className="mt-6" />
      <div className="pt-4">
        <SectionLabel>Friends ({friends.length})</SectionLabel>
      </div>
      {friends.length === 0 && outgoing.length === 0 && <p className="text-cream/50 text-sm">No friends yet. Share your invite link.</p>}
      <ul className="divide-y divide-gold/15">
        {friends.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5">
            <span className="text-cream">@{r.other?.username ?? 'anon'}</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
              Remove
            </Button>
          </li>
        ))}
        {outgoing.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5 text-cream/50 text-sm">
            <span>@{r.other?.username ?? 'anon'} · pending</span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => removeFriendship(r.id))}>
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </Page>
  )
}
