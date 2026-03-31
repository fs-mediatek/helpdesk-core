import { redirect } from "next/navigation"
import { getSession, verifyToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { DeviceClaimPrompt } from "@/components/assets/device-claim-prompt"
import { Chatbot } from "@/components/chat/chatbot"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const cookieStore = await cookies()
  const originalToken = cookieStore.get("original_token")?.value
  const originalSession = originalToken ? await verifyToken(originalToken) : null

  return (
    <DashboardShell
      user={{ name: session.name, role: session.role }}
      impersonating={originalSession ? { originalName: originalSession.name } : undefined}
    >
      {children}
      <DeviceClaimPrompt />
      <Chatbot />
    </DashboardShell>
  )
}
