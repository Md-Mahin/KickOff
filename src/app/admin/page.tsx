"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminPerformanceDashboard } from "@/components/dashboard/admin-performance-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuthUser = { userId: number; role: "fan" | "admin" }
type AdminUser = { id: number; name: string; email: string; role: string }

export default function AdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"performance" | "users">("performance")
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])

  const checkAuth = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/me", { credentials: "include" })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.user ?? null)
      if (data.user?.role === "admin") {
        fetch("http://localhost:5000/api/users/admin/users", { credentials: "include" })
          .then((r) => r.json())
          .then((uData) => setAdminUsers(uData.users ?? []))
          .catch(() => {})
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-600 text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <span>Verifying administrator privileges...</span>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-sm text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-xl mb-2 text-amber-700">
              âš¡
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">Administrator Access Required</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Player ratings and administrator tools are only available to signed-in administrator accounts. Fan accounts cannot access this information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 pt-1">
              <Link href="/sign-in" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">Sign in with your account</Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full text-xs">Return Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* â”€â”€ Top Header Bar â”€â”€ */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                  â† Back to Matches
                </Link>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-semibold text-slate-800">Admin Control Center</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                Administrator Dashboard
              </h1>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("performance")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "performance"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ðŸ“Š Player Performance & Ratings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "users"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ðŸ‘¥ User Management ({adminUsers.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main Content Area â”€â”€ */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === "performance" ? (
          <AdminPerformanceDashboard />
        ) : (
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold">Registered Users ({adminUsers.length})</CardTitle>
              <CardDescription className="text-xs">
                Platform accounts across fan and administrator roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminUsers.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-500">#{item.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.email}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.role === "admin"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
