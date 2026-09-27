"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Plus, UserMinus, Loader2 } from "lucide-react"
import { followEntity, unfollowEntity, checkFollowStatus, type FollowTargetType } from "@/lib/api"

export interface FollowButtonProps {
  targetType: FollowTargetType
  targetId: number
  initialIsFollowing?: boolean
  initialFollowersCount?: number
  onFollowChange?: (following: boolean, newCount: number) => void
  showCount?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function FollowButton({
  targetType,
  targetId,
  initialIsFollowing,
  initialFollowersCount,
  onFollowChange,
  showCount = false,
  size = "md",
  className = "",
}: FollowButtonProps) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState<boolean>(initialIsFollowing ?? false)
  const [followersCount, setFollowersCount] = useState<number>(initialFollowersCount ?? 0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)

  // Listen for external updates to keep all instances in sync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: FollowTargetType
        id: number
        following: boolean
        count: number
      }>
      if (customEvent.detail && customEvent.detail.type === targetType && customEvent.detail.id === targetId) {
        setIsFollowing(customEvent.detail.following)
        setFollowersCount(customEvent.detail.count)
      }
    }

    window.addEventListener("entity-follow-changed", handleSync)
    return () => window.removeEventListener("entity-follow-changed", handleSync)
  }, [targetType, targetId])

  // Verify status from server if not explicitly passed
  useEffect(() => {
    if (initialIsFollowing !== undefined) {
      setIsFollowing(initialIsFollowing)
      return
    }

    let isMounted = true
    checkFollowStatus(targetType, targetId).then((res) => {
      if (isMounted && res.authenticated) {
        setIsFollowing(res.following)
      }
    })
    return () => {
      isMounted = false
    }
  }, [targetType, targetId, initialIsFollowing])

  useEffect(() => {
    if (initialFollowersCount !== undefined) {
      setFollowersCount(initialFollowersCount)
    }
  }, [initialFollowersCount])

  const notifyChange = (following: boolean, count: number) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("entity-follow-changed", {
          detail: { type: targetType, id: targetId, following, count },
        })
      )
    }
    if (onFollowChange) onFollowChange(following, count)
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isLoading) return

    // Optimistic toggle
    const nextState = !isFollowing
    const optimisticCount = Math.max(0, followersCount + (nextState ? 1 : -1))

    setIsFollowing(nextState)
    setFollowersCount(optimisticCount)
    notifyChange(nextState, optimisticCount)

    setIsLoading(true)

    try {
      const res = nextState
        ? await followEntity(targetType, targetId)
        : await unfollowEntity(targetType, targetId)

      if (res.unauthorized) {
        // Rollback and redirect to sign-in
        setIsFollowing(!nextState)
        setFollowersCount(followersCount)
        notifyChange(!nextState, followersCount)
        router.push("/sign-in")
        return
      }

      if (!res.success) {
        // Rollback on unexpected failure
        setIsFollowing(!nextState)
        setFollowersCount(followersCount)
        notifyChange(!nextState, followersCount)
      } else {
        // Sync with real count returned from DB
        setFollowersCount(res.followersCount)
        notifyChange(nextState, res.followersCount)
      }
    } catch {
      // Rollback
      setIsFollowing(!nextState)
      setFollowersCount(followersCount)
      notifyChange(!nextState, followersCount)
    } finally {
      setIsLoading(false)
    }
  }

  // Size variations
  const sizeClasses = {
    sm: "px-3 py-1 text-xs gap-1.5",
    md: "px-4 py-1.5 text-sm gap-2",
    lg: "px-6 py-2.5 text-base gap-2.5",
  }[size]

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isLoading}
      aria-pressed={isFollowing}
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 select-none shadow-sm cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed ${sizeClasses} ${
        isFollowing
          ? isHovered
            ? "bg-red-50 text-red-600 border border-red-300 hover:bg-red-100 hover:border-red-400"
            : "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700"
          : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
      } ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span>Updating...</span>
        </>
      ) : isFollowing ? (
        isHovered ? (
          <>
            <UserMinus className="h-4 w-4 text-red-600" />
            <span>Unfollow</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4 text-white stroke-[2.5]" />
            <span>Following</span>
          </>
        )
      ) : (
        <>
          <Plus className="h-4 w-4 text-slate-600 stroke-[2.5]" />
          <span>Follow</span>
        </>
      )}

      {showCount && (
        <span
          className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold tabular-nums ${
            isFollowing
              ? isHovered
                ? "bg-red-100 text-red-700"
                : "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {followersCount.toLocaleString()}
        </span>
      )}
    </button>
  )
}

export function FollowersCountBadge({
  targetType,
  targetId,
  initialCount,
  singularLabel = "follower",
  pluralLabel = "followers",
  formatCompact = false,
  className = "text-sm font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1",
}: {
  targetType: FollowTargetType
  targetId: number
  initialCount: number
  singularLabel?: string
  pluralLabel?: string
  formatCompact?: boolean
  className?: string
}) {
  const [count, setCount] = useState<number>(initialCount)

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: FollowTargetType
        id: number
        following: boolean
        count: number
      }>
      if (customEvent.detail && customEvent.detail.type === targetType && customEvent.detail.id === targetId) {
        setCount(customEvent.detail.count)
      }
    }

    window.addEventListener("entity-follow-changed", handleSync)
    return () => window.removeEventListener("entity-follow-changed", handleSync)
  }, [targetType, targetId])

  let formatted = count.toLocaleString()
  if (formatCompact && count >= 1000000) {
    formatted = `${(count / 1000000).toFixed(1)}M`
  } else if (formatCompact && count >= 1000) {
    formatted = `${(count / 1000).toFixed(1)}k`
  }

  const label = count === 1 ? singularLabel : pluralLabel

  return (
    <span className={className}>
      {formatted} {label}
    </span>
  )
}
