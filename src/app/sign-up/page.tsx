"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

const inputClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"

export default function SignUpPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      })
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        setError(data.message ?? "Unable to create your account. Please try again.")
        return
      }

      router.push("/sign-in?registered=1")
    } catch {
      setError("The registration service is unavailable. Please try again shortly.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Save your favourite teams and stay close to every match."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/sign-in"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Your name" className={inputClassName} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className={inputClassName} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" className={inputClassName} required />
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-2 h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to our <Link href="#" className="underline underline-offset-2 hover:text-foreground">Terms</Link> and <Link href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  )
}
