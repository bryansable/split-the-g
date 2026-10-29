import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloudEnabled, getProfile, supabase } from './supabase'
import { syncWithCloud } from './sync'
import type { Profile } from './types'

interface AuthValue {
  cloudEnabled: boolean
  loading: boolean
  session: Session | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  cloudEnabled,
  loading: false,
  session: null,
  profile: null,
  refreshProfile: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(cloudEnabled)

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null)
      return
    }
    try {
      setProfile(await getProfile(session.user.id))
    } catch {
      setProfile(null)
    }
  }, [session])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshProfile()
    if (session) syncWithCloud(session.user.id).catch((e) => console.warn('sync failed', e))
  }, [session, refreshProfile])

  return (
    <AuthContext.Provider value={{ cloudEnabled, loading, session, profile, refreshProfile }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
