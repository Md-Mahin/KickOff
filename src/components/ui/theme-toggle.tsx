"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("kickoff_theme")
    const isDarkClass = document.documentElement.classList.contains("dark")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (stored === "dark" || (!stored && (isDarkClass || prefersDark))) {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    } else {
      document.documentElement.classList.remove("dark")
      setIsDark(false)
    }
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)

    if (nextDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("kickoff_theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("kickoff_theme", "light")
    }
  }

  // Render a placeholder pill during SSR to prevent layout shift
  if (!mounted) {
    return (
      <div
        className="w-12 h-6 rounded-full bg-gray-700/60 border border-gray-600/40 p-0.5 inline-flex items-center opacity-70"
        aria-hidden="true"
      >
        <span className="w-5 h-5 rounded-full bg-gray-500 inline-block" />
      </div>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#621298] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 border ${
        isDark
          ? "bg-[#200530] border-[#621298]/60 shadow-[0_0_10px_rgba(98,18,152,0.35)]"
          : "bg-gray-700/80 border-gray-600/50 hover:bg-gray-700"
      }`}
    >
      {/* Background minimized icons for context */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className="h-3 w-3 text-amber-400/70" />
        <Moon className="h-3 w-3 text-purple-300/60" />
      </span>

      {/* Sliding Toggle Knob with minimized active icon */}
      <span
        className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-in-out ${
          isDark
            ? "translate-x-6 bg-[#621298] text-white border border-[#831ebf]"
            : "translate-x-0 bg-amber-400 text-slate-900"
        }`}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-purple-100" />
        ) : (
          <Sun className="h-3 w-3 text-amber-950" />
        )}
      </span>
    </button>
  )
}

