import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

const inputClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to follow the matches that matter to you."
      footerText="New to KickOff?"
      footerLinkLabel="Create an account"
      footerHref="/sign-up"
    >
      <form className="space-y-4">
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

        <Button type="submit" className="mt-2 h-10 w-full">Sign in</Button>
      </form>
    </AuthShell>
  )
}
