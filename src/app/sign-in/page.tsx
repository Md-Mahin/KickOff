"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

const inputClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"

export default function SignInPage() {
  const router = useRouter() 
  const [error, setError] = useState("")
  const [registered] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registered") === "1")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      })
      const data = (await response.json()) as { message?: string; user?: unknown }

      if (!response.ok || !data.user) {
        setError(data.message ?? "Unable to sign in. Please try again.")
        return
      }

      router.push("/")
    } catch {
      setError("The sign-in service is unavailable. Please try again shortly.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to follow the matches that matter to you."
      footerText="New to KickOff?"
      footerLinkLabel="Create an account"
      footerHref="/sign-up"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {registered ? (
          <p className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-700" role="status">
            Account created. You can sign in now.
          </p>
        ) : null}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className={inputClassName} required />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">Forgot password?</Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" className={inputClassName} required />
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-2 h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  )
}
