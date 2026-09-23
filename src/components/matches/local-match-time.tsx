"use client"

import { useEffect, useState } from "react"

export function LocalMatchTime({ startTime }: { startTime?: string }) {
  const [formattedTime, setFormattedTime] = useState<string | null>(null)

  useEffect(() => {
    if (!startTime) return

    const date = new Date(startTime)
    if (Number.isNaN(date.getTime())) return

    setFormattedTime(
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date),
    )
  }, [startTime])

  if (!startTime || !formattedTime) return null

  return <span>{formattedTime}</span>
}