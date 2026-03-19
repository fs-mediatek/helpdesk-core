"use client"
import { useState, useEffect } from "react"
import { Users, Plus, Pencil, Trash2, Lock, Unlock, LogIn, X, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { fetchRoles, type RoleDef } from "@/lib/roles"

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

function RoleBadge({ role, roles }: { role: string; roles: RoleDef[] }) {
  const colorMap = Object.fromEntries(roles.map(r => [r.key_name, r.color || "bg-muted text-muted-foreground border-muted"]))
  const labelMap = Object.fromEntries(roles.map(r => [r.key_name, r.label]))
  return (
    <div className="flex flex-wrap gap-1">
      {role.split(",").map(r => r.trim()).filter(Boolean).map(r => (
        <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorMap[r] || "bg-muted text-muted-foreground border-muted"}`}>
          {labelMap[r] || r}
        </span>
      ))}
    </div>
  )
}

interface User { id: number; name: string; email: string; role: string; department: string | null; phone?: string | null; active: number; created_at: string }

function UserModal({ user, roles, departments, onClose, onSaved }: { user?: User; roles: RoleDef[]; departments: { id: number; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const ALL_ROLES = roles.map(r => r.key_name)
  const ROLE_LABELS = Object.fromEntries(roles.map(r => [r.key_name, r.label]))
  const ROLE_COLORS = Object.fromEntries(roles.map(r => [r.key_name, r.color || "bg-muted text-muted-foreground border-muted"]))
  const [form, setForm] = useState({
    name: user?.name || "", email: user?.email || "",
    department: user?.department || "", phone: user?.phone || "",
    roles: (user?.role || "user").split(",").map(r => r.trim()).filter(Boolean),
    password: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const toggleRole = (r: string) =>
    setForm(f => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r] }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { setError("Name und E-Mail erforderlich"); return }
    if (form.roles.length === 0) { setError("Mindestens eine Rolle erforderlich"); return }
    if (!user && !form.password) { setError("Passwort erforderlich für neuen Benutzer"); return }
    setSaving(true); setError(null)
    try {
      const body: any = {
        name: form.name.trim(), email: form.email.trim(),
        department: form.department || null, phone: form.phone || null,
        role: form.roles.join(",")
      }
      if (form.password) body.password = form.password
      const res = await fetch(user ? `/api/users/${user.id}` : "/api/users", {
        method: user ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{user ? "Benutzer bearbeiten" : "Neuer Benutzer"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Name *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">E-Mail *</label>
              <input type="email" className={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Abteilung</label>
              <select className={inp} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                <option value="">— Keine —</option>
                {departments.map(d => <option key={d.id} value={d.name}>{(d as any).display_name || d.name}</option>)}
              </select></div>
            <div><label className="text-sm font-medium mb-1 block">Telefon</label>
              <input className={inp} value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+49 ..." /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Passwort {user ? "(leer lassen = unverändert)" : "*"}</label>
            <input type="password" className={inp} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={user ? "Neues Passwort..." : "Mindestens 8 Zeichen"} /></div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rollen *</label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-input bg-background">
              {ALL_ROLES.map(r => (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${form.roles.includes(r) ? (ROLE_COLORS[r] + " ring-2 ring-offset-1 ring-primary/40") : "bg-muted text-muted-foreground border-transparent hover:border-input"}`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{user ? "Speichere..." : "Erstelle..."}</> : user ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function UsersClient({ initialUsers }: { initialUsers: any[] }) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(initialUsers as User[])
  const [search, setSearch] = useState("")
  const [editUser, setEditUser] = useState<User | null | "new">(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [roles, setRoles] = useState<RoleDef[]>([])
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    fetchRoles().then(setRoles)
    fetch("/api/departments").then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const reload = async () => {
    const r = await fetch("/api/users")
    const d = await r.json()
    setUsers(Array.isArray(d) ? d : [])
  }

  const toggleActive = async (u: User) => {
    setLoadingId(u.id)
    await fetch(`/api/users/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: u.active ? 0 : 1 }) })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: u.active ? 0 : 1 } : x))
    setLoadingId(null)
  }

  const deleteUser = async (u: User) => {
    if (!confirm(`Benutzer "${u.name}" wirklich löschen?`)) return
    setLoadingId(u.id)
    await fetch(`/api/users/${u.id}`, { method: "DELETE" })
    setUsers(prev => prev.filter(x => x.id !== u.id))
    setLoadingId(null)
  }

  const loginAs = async (u: User) => {
    if (!confirm(`Als "${u.name}" anmelden?\nDu kannst dich danach mit deinem Admin-Account wieder einloggen.`)) return
    const res = await fetch(`/api/users/${u.id}/impersonate`, { method: "POST" })
    if (res.ok) { router.push("/dashboard"); router.refresh() }
    else alert("Impersonation fehlgeschlagen")
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Benutzer</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{users.length} Benutzer registriert</p>
        </div>
        <Button onClick={() => setEditUser("new")}><Plus className="h-4 w-4" /> Neuer Benutzer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          className="flex h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Benutzer suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Benutzer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rolle</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Abteilung</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">{initials(u.name)}</div>
                    <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={u.role} roles={roles} /></td>
                <td className="px-4 py-3 text-muted-foreground">{u.department || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${u.active ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                    {u.active ? "Aktiv" : "Gesperrt"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {loadingId === u.id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
                      <>
                        <button onClick={() => setEditUser(u)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Bearbeiten">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => toggleActive(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.active ? "hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600" : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"}`}
                          title={u.active ? "Anmeldung sperren" : "Anmeldung freischalten"}>
                          {u.active ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => loginAs(u)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition-colors" title="Als dieser Benutzer anmelden">
                          <LogIn className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteUser(u)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Keine Benutzer gefunden</p>
          </div>
        )}
      </div>

      {editUser && (
        <UserModal
          user={editUser === "new" ? undefined : editUser}
          roles={roles}
          departments={departments}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reload() }}
        />
      )}
    </div>
  )
}
