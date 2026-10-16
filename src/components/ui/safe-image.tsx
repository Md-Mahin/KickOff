"use client"

import Image from "next/image"
import { Shield, Trophy, UserRound } from "lucide-react"
import { useState } from "react"
import { imageRenderState, isImageHostConfiguredForOptimization, rememberFailedImageSource } from "@/lib/image-fallback.mjs"

type FallbackKind = "team" | "person" | "tournament"

type SafeImageProps = {
  src?: string | null
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
  fallbackKind?: FallbackKind
}

const FALLBACK_ICON = {
  team: Shield,
  person: UserRound,
  tournament: Trophy,
}

export function SafeImage({
  src,
  alt,
  width = 64,
  height = 64,
  fill = false,
  sizes,
  priority,
  className = "",
  fallbackKind = "team",
}: SafeImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const state = imageRenderState(src)
  const failed = state.showFallback || failedSource === state.source
  const Icon = FALLBACK_ICON[fallbackKind]

  if (failed || !state.source) {
    const fallbackClass = fill
      ? "absolute inset-0 flex items-center justify-center text-muted-foreground"
      : `inline-flex shrink-0 items-center justify-center text-muted-foreground ${className}`
    return (
      <span role="img" aria-label={`${alt} unavailable`} className={fallbackClass}>
        <Icon aria-hidden="true" className="h-1/2 w-1/2 max-h-8 max-w-8" />
      </span>
    )
  }

  return (
    <Image
      src={state.source}
      alt={alt}
      {...(fill ? { fill: true } : { width, height })}
      sizes={sizes}
      priority={priority}
      unoptimized={!isImageHostConfiguredForOptimization(state.source)}
      className={className}
      onError={() => {
        rememberFailedImageSource(state.source!)
        setFailedSource(state.source)
      }}
    />
  )
}
