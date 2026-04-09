import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

const nav = [
  { to: '/', label: 'Overview' },
  { to: '/consent', label: 'Survivor Control' },
  { to: '/interview', label: 'Fragment Intake' },
  { to: '/neural', label: 'Signal View' },
  { to: '/inference', label: 'Timeline Engine' },
  { to: '/story', label: 'Fragment Review' },
  { to: '/dashboard', label: 'Legal Dashboard' },
  { to: '/legal', label: 'Cross-Exam Prep' },
  { to: '/output', label: 'Daubert Export' },
]

export default function Layout() {
  const loc = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const routeIndex = useMemo(() => nav.findIndex((x) => x.to === loc.pathname), [loc.pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '1' && e.key <= '8') {
        const idx = Number(e.key) - 1
        if (nav[idx]) navigate(nav[idx].to)
      }
      if (e.key === 'ArrowRight') {
        const next = Math.min(nav.length - 1, Math.max(0, routeIndex) + 1)
        navigate(nav[next].to)
      }
      if (e.key === 'ArrowLeft') {
        const prev = Math.max(0, Math.max(0, routeIndex) - 1)
        navigate(nav[prev].to)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, routeIndex])

  return (
    <div className="app-root">
      <div className="hover-zone" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} />
      <aside className={`sidebar scanlines ${open ? 'open' : ''}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <div className="sidebar-brand">VI<span>DHI</span></div>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav">
          {nav.map(({ to, label }) => (
            <Link key={to} to={to} className={`sidebar-link ${loc.pathname === to ? 'active' : ''}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="status-dot" /> FRAGMENT VAULT · HASH-STAMPED
        </div>
      </aside>
      <main className="page-shell">
        <div className="page-frame scanlines" key={loc.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
