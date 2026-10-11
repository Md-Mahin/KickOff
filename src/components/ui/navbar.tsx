"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { useEffect, useState } from "react"

import GlobalSearch from "./global-search"
import NotificationsMenu from "./notifications-menu"
import ThemeToggle from "./theme-toggle"
import { BACKEND_URL } from "@/lib/backend-url"

export default function Navbar() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch(`${BACKEND_URL}/api/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          setSignedIn(true)
          setIsAdmin(data.user?.role === "admin")
        } else {
          setSignedIn(false)
          setIsAdmin(false)
        }
      })
      .catch(() => {
        setSignedIn(false)
        setIsAdmin(false)
      })
  }, [])

  async function logout() {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch (e) {
      console.warn("Logout error:", e)
    }
    // Also explicitly expire client cookies
    document.cookie = "kickoff_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
    document.cookie = "kickoff_session=; Path=/; Domain=localhost; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
    setSignedIn(false)
    setIsAdmin(false)
    window.location.href = "/"
  }

  return (
    <nav className="relative z-30 bg-gray-900 dark:bg-[#2b0844] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.9),0_6px_24px_rgba(98,18,152,0.38)] transition-all duration-200">
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
            <Link href="/" className="flex shrink-0 items-center gap-3 group">
              <Image
                src="/kickoff_main_logo.png"
                alt="KickOff Logo"
                width={151}
                height={82}
                className="h-10 w-auto object-contain transition-opacity group-hover:opacity-90"
                priority
              />
              <Image
                src="/kickoff_logo_with_motto.png"
                alt="KickOff Motto"
                width={209}
                height={38}
                className="h-7 w-auto object-contain transition-opacity group-hover:opacity-90"
                priority
              />
            </Link>

            {/* Desktop navigation */}
            <div className="hidden sm:ml-6 sm:block">
              <div className="flex space-x-4">

                <Link
                  href="/"
                  className="rounded-md bg-gray-900 dark:bg-[#621298] px-3 py-2 text-sm font-medium text-white transition-colors"
                >
                  Dashboard
                </Link>

                {/* Shown IF AND ONLY IF an account with admin privilege is signed in */}
                {signedIn && isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-md px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors text-amber-300 hover:bg-white/10 hover:text-white"
                  >
                    <span>⚡</span> Admin Ratings
                  </Link>
                )}

              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0 gap-1.5 sm:gap-2">

            <GlobalSearch />

            {/* Notifications */}
            <NotificationsMenu signedIn={signedIn} />

            {/* Dark Mode Switch */}
            <div className="mx-1 flex items-center">
              <ThemeToggle />
            </div>

            {mounted
              ? signedIn
                ? <button type="button" onClick={logout} className="ml-2 rounded-md bg-white hover:bg-gray-100 text-gray-900 px-3 py-1.5 text-sm font-semibold transition shadow-sm">Log out</button>
                : <Link href="/sign-in" className="ml-2 rounded-md bg-white hover:bg-gray-100 text-gray-900 px-3 py-1.5 text-sm font-semibold transition shadow-sm">Sign in</Link>
              : <Link href="/sign-in" className="ml-2 rounded-md bg-white hover:bg-gray-100 text-gray-900 px-3 py-1.5 text-sm font-semibold transition shadow-sm">Sign in</Link>
            }

          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="sm:hidden">
        <div className="space-y-1 px-2 pt-2 pb-3">

          <Link
            href="/"
            className="block rounded-md bg-gray-900 dark:bg-[#621298] px-3 py-2 text-base font-medium text-white transition-colors"
          >
            Dashboard
          </Link>

          {/* Shown IF AND ONLY IF an account with admin privilege is signed in */}
          {signedIn && isAdmin && (
            <Link
              href="/admin"
              className="block rounded-md px-3 py-2 text-base font-medium text-amber-300 hover:bg-white/10"
            >
              ⚡ Admin Ratings
            </Link>
          )}

          <div className="px-3 py-2 flex items-center justify-between border-t border-gray-700 dark:border-[#621298]/30 mt-2 pt-2">
            <span className="text-sm font-medium text-gray-300 dark:text-purple-200">Theme</span>
            <ThemeToggle />
          </div>

        </div>
      </div>
    </nav>
  )
}
