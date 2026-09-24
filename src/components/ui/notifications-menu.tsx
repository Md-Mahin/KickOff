"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Clock, Radio, CheckCheck, CheckCircle2, ChevronRight, X } from "lucide-react"
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "@/lib/api"

function formatTimeAgo(dateStr: string) {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function NotificationTypeBadge({ type }: { type: NotificationItem["type"] }) {
  if (type === "ABOUT_TO_START") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
        <Clock className="h-3 w-3" />
        Starting Soon
      </span>
    )
  }
  if (type === "JUST_STARTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Now
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <CheckCircle2 className="h-3 w-3" />
      Finished
    </span>
  )
}

export default function NotificationsMenu({ signedIn }: { signedIn: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchItems = async () => {
    if (!signedIn) return
    try {
      const data = await getNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Ignored
    }
  }

  useEffect(() => {
    if (!signedIn) return

    fetchItems()

    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchItems, 30000)

    // Also refresh on window focus
    const onFocus = () => fetchItems()
    window.addEventListener("focus", onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
    }
  }, [signedIn])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markNotificationAsRead(item.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setIsOpen(false)
    router.push(`/match/${item.matchId}`)
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-full p-2 text-gray-400 hover:text-white transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="size-6" />
        {signedIn && unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-gray-800 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">
                  {unreadCount} new
                </span>
              )}
            </div>
            {signedIn && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List or Prompt */}
          {!signedIn ? (
            <div className="p-6 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in to receive alerts when your followed teams and players kick off or finish.
              </p>
              <Link
                href="/sign-in"
                onClick={() => setIsOpen(false)}
                className="inline-block rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign in
              </Link>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                Follow your favorite teams or players to get alerted before kickoff, at match start, and at full time.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`group flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer text-left ${
                    !item.isRead ? "bg-muted/20" : ""
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="mt-1 flex-shrink-0">
                    {!item.isRead ? (
                      <span className="block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                    ) : (
                      <span className="block h-2 w-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <NotificationTypeBadge type={item.type} />
                      {item.entityName && (
                        <span className="text-[11px] font-medium text-muted-foreground truncate">
                          • {item.entityName}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </p>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                      <span className="flex items-center text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        View Match <ChevronRight className="h-3 w-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

