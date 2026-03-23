import { redirect } from "next/navigation"
import { getSession, verifyToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { DeviceClaimPrompt } from "@/components/assets/device-claim-prompt"
import { Chatbot } from "@/components/chat/chatbot"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const cookieStore = await cookies()
  const originalToken = cookieStore.get("original_token")?.value
  const originalSession = originalToken ? await verifyToken(originalToken) : null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={{ name: session.name, role: session.role }}
          impersonating={originalSession ? { originalName: originalSession.name } : undefined}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <DeviceClaimPrompt />
      <Chatbot />
    </div>
  )
}
