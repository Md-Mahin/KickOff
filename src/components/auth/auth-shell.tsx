import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type AuthShellProps = {
  children: React.ReactNode
  title: string
  description: string
  footerText: string
  footerLinkLabel: string
  footerHref: string
}

export function AuthShell({
  children,
  title,
  description,
  footerText,
  footerLinkLabel,
  footerHref,
}: AuthShellProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Back to scores
          </Link>
        </Button>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="items-center px-6 pt-7 text-center sm:px-8">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-gray-800 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <p className="text-lg font-bold tracking-tight">KickOff</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </CardHeader>

          <CardContent className="px-6 pb-7 sm:px-8">
            {children}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footerText}{" "}
              <Link href={footerHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                {footerLinkLabel}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
