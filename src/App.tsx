import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Chalkboard, Cheers, Person, Pint, PubSign, Shamrock, Trophy } from './components/icons'
import { AuthProvider, useAuth } from './data/AuthContext'
import { Contest } from './screens/Contest'
import { Friends } from './screens/Friends'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Profile } from './screens/Profile'
import { Result } from './screens/Result'
import { Score } from './screens/Score'

const allTabs = [
  { to: '/', label: 'Home', Icon: PubSign, cloud: false },
  { to: '/score', label: 'Score', Icon: Pint, cloud: false },
  { to: '/history', label: 'History', Icon: Chalkboard, cloud: false },
  { to: '/friends', label: 'Friends', Icon: Cheers, cloud: true },
  { to: '/contest', label: 'Contest', Icon: Trophy, cloud: true },
]

function Shell() {
  const { pathname } = useLocation()
  const { session, profile, cloudEnabled } = useAuth()
  const fullBleed = pathname === '/score'
  // Social features appear only once the backend is live.
  const tabs = allTabs.filter((t) => cloudEnabled || !t.cloud)

  return (
    <div className="h-dvh flex flex-col bg-ink text-cream">
      {!fullBleed && (
        <header className="relative flex items-center justify-between px-4 pt-[calc(0.6rem+env(safe-area-inset-top))] pb-2.5 bg-wood border-b-2 pub-rule">
          <NavLink to="/" className="flex items-center gap-2 font-display text-gold tracking-[0.2em] uppercase text-sm">
            <Shamrock size={18} />
            Split The G
          </NavLink>
          <NavLink to="/profile" className="flex items-center gap-1.5 text-xs text-cream/75 hover:text-gold">
            <Person size={18} />
            {cloudEnabled ? (session ? `@${profile?.username ?? 'set name'}` : 'Sign in') : 'About'}
          </NavLink>
        </header>
      )}
      <main className={`flex-1 min-h-0 flex flex-col ${fullBleed ? '' : 'overflow-y-auto'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/score" element={<Score />} />
          <Route path="/result" element={<Result />} />
          <Route path="/history" element={<History />} />
          <Route path="/friends" element={cloudEnabled ? <Friends /> : <Navigate to="/" replace />} />
          <Route path="/contest" element={cloudEnabled ? <Contest /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <nav className="flex bg-wood border-t-2 pub-rule pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] uppercase tracking-[0.14em] font-display ${isActive ? 'text-gold' : 'text-cream/45'}`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  )
}
