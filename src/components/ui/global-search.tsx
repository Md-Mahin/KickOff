"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Star, Users } from "lucide-react"

const FILTERS = ["All", "Team", "Player", "Match", "Competition", "News", "Manager", "Referee", "Venue"]

type SearchResult = {
  id: string;
  name: string;
  followers: string;
  country: string;
  flag: string;
  sport: string;
  avatar: string;
  type: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    const delayDebounceFn = setTimeout(() => {
      setLoading(true)
      fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(searchQuery)}&type=${encodeURIComponent(activeFilter)}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setResults(data)
          } else {
            console.error("API Error or invalid response:", data)
            setResults([]) // Fallback to empty array
          }
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setResults([])
          setLoading(false)
        })
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, activeFilter])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div className="relative mr-2 sm:mr-4" ref={containerRef}>
      {/* Collapsed State (Header Trigger) */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-9 w-full sm:w-64 items-center justify-between rounded-full bg-gray-900 px-3 text-sm text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search KickOff...</span>
        </div>
        <kbd className="hidden sm:inline-block rounded bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-400 font-sans border border-gray-700">
          <span className="text-xs">Ctrl K</span>
        </kbd>
      </button>

      {/* Expanded State (Search Modal Overlay) */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] sm:w-[500px] origin-top-right rounded-xl bg-white shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden flex flex-col">
          {/* Main Input */}
          <div className="flex items-center border-b border-gray-100 px-4 py-3 shrink-0">
            <Search className="h-5 w-5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="ml-3 flex-1 border-0 bg-transparent text-gray-900 placeholder-gray-500 focus:outline-none sm:text-sm"
              placeholder="Search matches, competitions, teams, players, and more"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Row */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-3 shrink-0 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeFilter === filter
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Results Container */}
          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
            ) : results.length === 0 && searchQuery.trim() !== "" ? (
              <div className="p-4 text-center text-sm text-gray-500">No results found for "{searchQuery}"</div>
            ) : (
              results.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between rounded-lg p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.avatar} alt={item.name} className="h-full w-full object-cover" />
                  </div>

                  {/* Data Stack */}
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center text-sm font-medium text-gray-900">
                      <span className="truncate">{item.name}</span>
                      <span className="ml-2 flex shrink-0 items-center text-xs text-gray-500">
                        <Users className="mr-1 h-3 w-3" />
                        {item.followers}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 truncate flex items-center">
                      {item.flag} {item.country} <span className="mx-1">•</span> ⚽ {item.sport} <span className="mx-1">•</span> {item.type}
                    </div>
                  </div>

                  {/* Action */}
                  <button 
                    className="ml-4 shrink-0 rounded-full p-2 text-gray-400 hover:bg-white hover:text-yellow-400 hover:shadow-sm transition-all focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      // toggle favorite logic here
                    }}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

