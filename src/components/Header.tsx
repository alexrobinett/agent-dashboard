import { Link } from '@tanstack/react-router'

import { useEffect, useRef, useState } from 'react'
import { Home, Menu, X, LogOut, Bot, ChartLine } from 'lucide-react'
import { useSession, signOut } from '../lib/auth.client'
import { ThemeToggle } from './ThemeToggle'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  const { data: session } = useSession()

  useEffect(() => {
    const aside = asideRef.current
    if (!aside || !isOpen) return

    const focusable = Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    first?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab' || !first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    aside.addEventListener('keydown', onKeyDown)
    return () => aside.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login'
        },
      },
    })
  }

  return (
    <>
      <header className="flex items-center border-b border-border bg-card p-4 text-card-foreground shadow-sm">
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg p-2 transition-colors hover:bg-secondary"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="ml-4 flex-1 text-xl font-semibold">
          <Link to="/" className="flex items-center gap-2 transition-colors hover:text-primary">
            <Bot size={22} className="text-primary" />
            <span>Agent Dashboard</span>
          </Link>
        </h1>

        <div className="mr-3 hidden sm:block">
          <ThemeToggle />
        </div>

        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="hidden text-sm text-muted-foreground md:inline">
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 transition-colors hover:bg-secondary"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        )}
      </header>

      <aside
        ref={asideRef}
        aria-hidden={!isOpen}
        className={`fixed left-0 top-0 z-50 flex h-full w-80 transform flex-col border-r border-border bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-secondary"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 sm:hidden">
            <ThemeToggle />
          </div>
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
            activeProps={{
              className:
                'mb-2 flex items-center gap-3 rounded-lg bg-primary p-3 text-primary-foreground transition-colors hover:bg-primary/90',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          <Link
            to="/cost"
            onClick={() => setIsOpen(false)}
            className="mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
            activeProps={{
              className:
                'mb-2 flex items-center gap-3 rounded-lg bg-primary p-3 text-primary-foreground transition-colors hover:bg-primary/90',
            }}
          >
            <ChartLine size={20} />
            <span className="font-medium">Cost Analytics</span>
          </Link>

          {/* Demo Links Start */}

          {/* Demo Links End */}
        </nav>

        {session?.user && (
          <div className="border-t border-border p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-secondary"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
