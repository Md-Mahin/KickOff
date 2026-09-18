"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Menu } from "lucide-react"
import { useEffect, useState } from "react"

export default function Navbar() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch("http://localhost:5000/api/auth/me", { credentials: "include" }).then((response) => setSignedIn(response.ok)).catch(() => setSignedIn(false))
  }, [])

  async function logout() {
    await fetch("http://localhost:5000/api/auth/logout", { method: "POST", credentials: "include" })
    setSignedIn(false)
    router.push("/sign-in")
  }

  return (
    <nav className="relative bg-gray-800">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">

          {/* Mobile menu button */}
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <button
              type="button"
              className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-none"
              aria-label="Open main menu"
            >
              <Menu className="size-6" />
            </button>
          </div>

          {/* Logo + Navigation */}
          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">

            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center">
              <span className="text-2xl font-bold text-white">
                KickOff
              </span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden sm:ml-6 sm:block">
              <div className="flex space-x-4">

                <Link
                  href="/"
                  className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                >
                  Dashboard
                </Link>

              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">

            {/* Notifications */}
            <button
              type="button"
              className="relative rounded-full p-2 text-gray-400 hover:text-white focus:outline-none"
              aria-label="Notifications"
            >
              <Bell className="size-6" />
            </button>

            {mounted
              ? signedIn
                ? <button type="button" onClick={logout} className="ml-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100">Log out</button>
                : <Link href="/sign-in" className="ml-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100">Sign in</Link>
              : <Link href="/sign-in" className="ml-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100">Sign in</Link>
            }

          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="sm:hidden">
        <div className="space-y-1 px-2 pt-2 pb-3">

          <Link
            href="/"
            className="block rounded-md bg-gray-900 px-3 py-2 text-base font-medium text-white"
          >
            Dashboard
          </Link>

        </div>
      </div>
    </nav>
  )
}
