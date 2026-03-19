import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { redirect } from "next/navigation"
import { UsersClient } from "@/components/users/users-client"

export default async function UsersPage() {
  const session = await getSession()
  if (!session?.role.includes("admin")) redirect("/dashboard")
  const users = await query("SELECT id, name, email, role, department, phone, active, created_at FROM users ORDER BY name ASC")
  return <UsersClient initialUsers={users} />
}
