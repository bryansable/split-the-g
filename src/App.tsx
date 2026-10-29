import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/AuthContext'
import { Contest } from './screens/Contest'
import { Friends } from './screens/Friends'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Profile } from './screens/Profile'
import { Result } from './screens/Result'
import { Score } from './screens/Score'

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/score', label: 'Score', icon: '🍺' },
  { to: '/history', label: 'History', icon: '📈' },
  { to: '/friends', label: 'Friends', icon: '👥' },
  { to: '/contest', label: 'Contest', icon: '🏆' },
]

function Shell() {
  const { pathname } = useLocation()
  const { session, profile } = useAuth()
  const fullBleed = pathname === '/score'

  return (
    <div className="h-dvh flex flex-col bg-ink text-cream">
      {!fullBleed && (
        <header className="flex items-center justify-between px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 border-b border-white/10">
          <NavLink to="/" className="font-serif text-lg tracking-wide">
            Split The G
          </NavLink>
          <NavLink to="/profile" className="text-sm text-cream/70 hover:text-cream">
            {session ? `@${profile?.username ?? 'set name'}` : 'Sign in'}
          </NavLink>
        </header>
      )}
      <main className={`flex-1 min-h-0 ${fullBleed ? '' : 'overflow-y-auto'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/score" element={<Score />} />
          <Route path="/result" element={<Result />} />
          <Route path="/history" element={<History />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/contest" element={<Contest />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <nav className="flex border-t border-white/10 bg-ink pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `flex-1 flex flex-col items-center py-2 text-[11px] ${isActive ? 'text-cream' : 'text-cream/40'}`}
          >
            <span className="text-lg leading-none mb-0.5">{t.icon}</span>
            {t.label}
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
