"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Building2, Mail, Palette, Save, Loader2, LayoutGrid, Menu, Check, Shield, Plus, Trash2, X,
  Hash, Pencil, Users, ChevronLeft, ArrowLeft, UserPlus, Phone
} from "lucide-react"
import { NAV_ITEMS_META } from "@/components/layout/sidebar"
import { fetchRoles, type RoleDef } from "@/lib/roles"

const SECTIONS = [
  { id: "company", label: "Unternehmen", icon: Building2, desc: "Firmenname, Anrede und Branding" },
  { id: "departments", label: "Abteilungen", icon: Users, desc: "Zentrale Abteilungsverwaltung" },
  { id: "roles", label: "Rollen", icon: Shield, desc: "Benutzerrollen hinzufügen und verwalten" },
  { id: "numbering", label: "Nummerierung", icon: Hash, desc: "Format für Ticket- und Bestellnummern" },
  { id: "email", label: "E-Mail-Versand", icon: Mail, desc: "SMTP-Server und Mail-Gateway" },
  { id: "nav", label: "Menü-Sichtbarkeit", icon: Menu, desc: "Navigation nach Rolle steuern" },
  { id: "onboarding", label: "Onboarding", icon: UserPlus, desc: "Status, Jobtitel, Maßnahmen und Rufnummern-Prefix", href: "/p/onboarding/settings" },
  { id: "catalog", label: "Produktkatalog", icon: LayoutGrid, desc: "Verwaltungszugang für den Katalog" },
  { id: "branding", label: "Branding", icon: Palette, desc: "Farben und Logo anpassen" },
]

const ALWAYS_VISIBLE = ["dashboard", "settings"]

export function SettingsClient({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Roles
  const [roles, setRoles] = useState<RoleDef[]>([])
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleKey, setNewRoleKey] = useState("")
  const [newRoleLabel, setNewRoleLabel] = useState("")
  const [roleError, setRoleError] = useState<string | null>(null)

  // Departments
  const [departments, setDepartments] = useState<{ id: number; name: string; display_name: string; parent_id: number | null; depth: number }[]>([])
  const [deptTree, setDeptTree] = useState<any[]>([])
  const [newDept, setNewDept] = useState("")
  const [newDeptParent, setNewDeptParent] = useState<number | null>(null)
  const [editDeptId, setEditDeptId] = useState<number | null>(null)
  const [editDeptName, setEditDeptName] = useState("")

  // Nav visibility
  const [navVisibility, setNavVisibility] = useState<Record<string, string>>({})
  const [pluginItems, setPluginItems] = useState<{ key: string; label: string }[]>([])

  const ALL_ROLES = roles.map(r => r.key_name)
  const ROLE_LABELS: Record<string, string> = Object.fromEntries(roles.map(r => [r.key_name, r.label]))

  const loadRoles = () => fetchRoles().then(setRoles)
  const loadDepts = async () => {
    const [flat, tree] = await Promise.all([
      fetch("/api/departments").then(r => r.json()).catch(() => []),
      fetch("/api/departments?format=tree").then(r => r.json()).catch(() => []),
    ])
    setDepartments(Array.isArray(flat) ? flat : [])
    setDeptTree(Array.isArray(tree) ? tree : [])
  }

  useEffect(() => {
    if (initialSettings.nav_visibility) {
      try { setNavVisibility(JSON.parse(initialSettings.nav_visibility)) } catch {}
    }
    loadRoles()
    loadDepts()
    fetch("/api/plugins").then(r => r.ok ? r.json() : []).then((manifests: any[]) => {
      const items: { key: string; label: string }[] = []
      for (const m of manifests) { if (m.navItems?.length) items.push({ key: `plugin_${m.id}`, label: m.name || m.id }) }
      setPluginItems(items)
    }).catch(() => {})
  }, [initialSettings.nav_visibility])

  function set(key: string, value: string) { setSettings(s => ({ ...s, [key]: value })) }

  function toggleNavRole(itemKey: string, role: string) {
    setNavVisibility(prev => {
      const next = { ...prev }
      const current = (next[itemKey] || ALL_ROLES.join(",")).split(",").map(r => r.trim()).filter(Boolean)
      const has = current.includes(role)
      const updated = has ? current.filter(r => r !== role) : [...current, role]
      if (updated.length === ALL_ROLES.length) delete next[itemKey]
      else next[itemKey] = updated.join(",")
      return next
    })
  }

  function isNavRoleActive(itemKey: string, role: string): boolean {
    if (!navVisibility[itemKey]) return true
    return navVisibility[itemKey].split(",").map(r => r.trim()).includes(role)
  }

  async function save() {
    setSaving(true)
    const toSave: Record<string, string> = { ...settings, nav_visibility: JSON.stringify(navVisibility) }
    Object.keys(toSave).filter(k => k.startsWith("_")).forEach(k => delete toSave[k])
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSave) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const configurableNavItems = NAV_ITEMS_META.filter(i => !ALWAYS_VISIBLE.includes(i.key))
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  // ─── Section header with back button ───
  const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
    <div className="flex items-center gap-4 mb-6">
      <button onClick={() => setActiveSection(null)} className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">{desc}</p>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : saved ? "Gespeichert" : <><Save className="h-4 w-4" />Speichern</>}
      </Button>
    </div>
  )

  // ─── Tile overview ───
  if (!activeSection) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Systemkonfiguration verwalten</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SECTIONS.map(s => {
            const Icon = s.icon
            const isLink = !!(s as any).href
            const Wrapper = isLink ? "a" : "button"
            const wrapperProps = isLink ? { href: (s as any).href } : { onClick: () => setActiveSection(s.id) }
            return (
              <Wrapper key={s.id} {...wrapperProps as any}
                className="rounded-xl border bg-card p-5 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="font-semibold text-sm flex items-center gap-1.5">{s.label} {isLink && <span className="text-[10px] text-muted-foreground font-normal">↗</span>}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.desc}</p>
              </Wrapper>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Section: Unternehmen ───
  if (activeSection === "company") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="Unternehmen" desc="Allgemeine Firmendaten" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5"><Label>Unternehmensname</Label><Input value={settings.company_name || ""} onChange={e => set("company_name", e.target.value)} placeholder="Meine Firma GmbH" /></div>
          <div className="space-y-1.5"><Label>Anrede</Label>
            <Select value={settings.formality || "du"} onValueChange={v => set("formality", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="du">Du (informell)</SelectItem><SelectItem value="sie">Sie (formell)</SelectItem></SelectContent></Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── Section: Branding ───
  if (activeSection === "branding") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="Branding" desc="Farben und Logo anpassen" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5"><Label>Primärfarbe</Label>
            <div className="flex gap-2"><input type="color" value={settings.primary_color || "#4F46E5"} onChange={e => set("primary_color", e.target.value)} className="h-9 w-14 rounded-lg border cursor-pointer" /><Input value={settings.primary_color || "#4F46E5"} onChange={e => set("primary_color", e.target.value)} className="font-mono" /></div>
          </div>
          <div className="space-y-1.5"><Label>Logo-URL</Label><Input value={settings.logo_url || ""} onChange={e => set("logo_url", e.target.value)} placeholder="https://..." /></div>
        </CardContent>
      </Card>
    </div>
  )

  // ─── Section: Departments ───
  if (activeSection === "departments") {
    const toggleDeptRole = async (nodeId: number, nodeName: string, currentRoles: string, roleKey: string) => {
      const current = (currentRoles || "").split(",").filter(Boolean)
      const next = current.includes(roleKey) ? current.filter((r: string) => r !== roleKey) : [...current, roleKey]
      const newRoles = next.join(",") || null

      // Optimistic update in tree
      const updateNode = (nodes: any[]): any[] => nodes.map(n => ({
        ...n,
        default_roles: n.id === nodeId ? newRoles : n.default_roles,
        children: n.children ? updateNode(n.children) : [],
      }))
      setDeptTree(prev => updateNode(prev))

      await fetch("/api/departments", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nodeId, name: nodeName, default_roles: newRoles })
      })
    }

    const renderDeptNode = (node: any, depth: number = 0): React.ReactNode => {
      const nodeRoles = (node.default_roles || "").split(",").filter(Boolean)
      return (
        <div key={node.id}>
          <div className="rounded-xl border bg-card overflow-hidden" style={{ marginLeft: `${depth * 28}px` }}>
            <div className="flex items-center gap-2 px-3 py-2 group">
              {depth > 0 && <div className="w-3 h-px bg-muted-foreground/20 shrink-0" />}
              {editDeptId === node.id ? (
                <>
                  <input className={inp + " flex-1"} value={editDeptName} onChange={e => setEditDeptName(e.target.value)} autoFocus
                    onKeyDown={async e => { if (e.key === "Enter" && editDeptName.trim()) { await fetch("/api/departments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: node.id, name: editDeptName.trim(), old_name: node.name, default_roles: node.default_roles }) }); setEditDeptId(null); loadDepts() } if (e.key === "Escape") setEditDeptId(null) }} />
                  <button onClick={async () => { if (!editDeptName.trim()) return; await fetch("/api/departments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: node.id, name: editDeptName.trim(), old_name: node.name, default_roles: node.default_roles }) }); setEditDeptId(null); loadDepts() }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditDeptId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <div className={`flex-1 text-sm ${depth === 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                    {node.name}
                  </div>
                  <button onClick={() => { setNewDeptParent(node.id); setNewDept("") }} title="Sub-Abteilung"
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-primary transition-colors"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditDeptId(node.id); setEditDeptName(node.name) }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={async () => { if (!confirm(`"${node.name}"${node.children?.length ? " und alle Unterabteilungen" : ""} entfernen?`)) return; await fetch("/api/departments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: node.id }) }); loadDepts() }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </div>
            {/* Role chips */}
            {editDeptId !== node.id && (
              <div className="px-3 pb-2.5 flex flex-wrap gap-1">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide font-medium mr-1 self-center">Rollen:</span>
                {roles.map(r => {
                  const active = nodeRoles.includes(r.key_name)
                  return (
                    <button key={r.key_name} onClick={() => toggleDeptRole(node.id, node.name, node.default_roles || "", r.key_name)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all ${
                        active ? (r.color || "bg-primary/10 text-primary border-primary/30") : "border-transparent text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-muted"
                      }`}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {node.children?.length > 0 && (
            <div className="space-y-2 mt-2" style={{ marginLeft: `${depth * 28 + 14}px`, borderLeft: "2px solid var(--border)", paddingLeft: "14px" }}>
              {node.children.map((child: any) => renderDeptNode(child, depth + 1))}
            </div>
          )}
          {newDeptParent === node.id && (
            <div className="flex items-center gap-2 mt-2" style={{ marginLeft: `${(depth + 1) * 28}px` }}>
              <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder={`Sub-Abteilung von "${node.name}"...`} autoFocus className="flex-1"
                onKeyDown={async e => { if (e.key === "Enter" && newDept.trim()) { await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept.trim(), parent_id: node.id }) }); setNewDept(""); setNewDeptParent(null); loadDepts() } if (e.key === "Escape") setNewDeptParent(null) }} />
              <Button variant="outline" size="sm" disabled={!newDept.trim()} onClick={async () => { await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept.trim(), parent_id: node.id }) }); setNewDept(""); setNewDeptParent(null); loadDepts() }}><Plus className="h-3.5 w-3.5" /></Button>
              <button onClick={() => setNewDeptParent(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="animate-fade-in max-w-2xl">
        <SectionHeader title="Abteilungen" desc="Zentrale Verwaltung — Änderungen werden auf alle Benutzer übertragen" />
        <Card>
          <CardContent className="pt-6 space-y-2">
            {deptTree.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Noch keine Abteilungen angelegt.</p>}
            {deptTree.map(node => renderDeptNode(node, 0))}
            <div className="flex gap-2 pt-3 border-t mt-3">
              <Input value={newDeptParent === null ? newDept : ""} onChange={e => { setNewDept(e.target.value); setNewDeptParent(null) }}
                placeholder="Neue Hauptabteilung..."
                onKeyDown={async e => { if (e.key === "Enter" && newDept.trim() && newDeptParent === null) { await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept.trim() }) }); setNewDept(""); loadDepts() } }} />
              <Button variant="outline" disabled={!newDept.trim() || newDeptParent !== null} onClick={async () => { await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept.trim() }) }); setNewDept(""); loadDepts() }}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Section: Roles ───
  if (activeSection === "roles") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="Rollen" desc="Neue Rollen stehen sofort in Workflows, Benutzerverwaltung und Sichtbarkeit zur Verfügung" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <div key={r.key_name} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${r.color || "bg-gray-500/10 text-gray-600 border-gray-200"}`}>
                <span>{r.label}</span>
                <span className="text-[10px] opacity-50 font-mono">{r.key_name}</span>
                {!r.is_builtin && <button onClick={async () => { if (!confirm(`"${r.label}" löschen?`)) return; await fetch(`/api/roles/${r.key_name}`, { method: "DELETE" }); loadRoles() }} className="ml-1 opacity-40 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>}
              </div>
            ))}
          </div>
          {showAddRole ? (() => {
            const COLOR_PRESETS = [
              { label: "Cyan", value: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800", dot: "#06b6d4" },
              { label: "Indigo", value: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800", dot: "#6366f1" },
              { label: "Pink", value: "bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-800", dot: "#ec4899" },
              { label: "Orange", value: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800", dot: "#f97316" },
              { label: "Lime", value: "bg-lime-500/10 text-lime-600 border-lime-200 dark:border-lime-800", dot: "#84cc16" },
              { label: "Violet", value: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800", dot: "#8b5cf6" },
              { label: "Teal", value: "bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800", dot: "#14b8a6" },
              { label: "Gelb", value: "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800", dot: "#eab308" },
            ]
            return (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Neue Rolle erstellen</p><button onClick={() => { setShowAddRole(false); setRoleError(null) }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
              {roleError && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-xs text-red-700 dark:text-red-400">{roleError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Bezeichnung</Label><Input value={newRoleLabel} onChange={e => { setNewRoleLabel(e.target.value); if (!newRoleKey || newRoleKey === newRoleLabel.trim().toLowerCase().replace(/[^a-z0-9äöü]/g, "_").replace(/[äöü]/g, c => ({ä:"ae",ö:"oe",ü:"ue"}[c]||c))) { setNewRoleKey(e.target.value.trim().toLowerCase().replace(/[^a-z0-9äöü]/g, "_").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue")) } }} placeholder="z.B. Teamleitung" /></div>
                <div className="space-y-1"><Label className="text-xs">Schlüssel</Label><Input value={newRoleKey} onChange={e => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="z.B. teamleitung" className="font-mono" /></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Farbe</Label>
                <div className="flex gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button key={c.dot} type="button" onClick={() => set("_new_role_color", c.value)}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${settings._new_role_color === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ background: c.dot }} title={c.label} />
                  ))}
                </div>
              </div>
              <Button size="sm" disabled={!newRoleKey || !newRoleLabel} onClick={async () => {
                setRoleError(null)
                const color = settings._new_role_color || COLOR_PRESETS[0].value
                const res = await fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_name: newRoleKey, label: newRoleLabel, color }) })
                const data = await res.json()
                if (!res.ok) { setRoleError(data.error); return }
                setNewRoleKey(""); setNewRoleLabel(""); set("_new_role_color", ""); setShowAddRole(false); loadRoles()
              }}><Plus className="h-3.5 w-3.5" /> Rolle erstellen</Button>
            </div>)
          })() : (
            <Button variant="outline" size="sm" onClick={() => setShowAddRole(true)}><Plus className="h-3.5 w-3.5" /> Neue Rolle</Button>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // ─── Section: Numbering ───
  if (activeSection === "numbering") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="Nummerierung" desc="Variablen: {PREFIX}, {YEAR}, {YY}, {NUM}, {NUM:4}, {NUM:6}" />
      <div className="space-y-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Tickets</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5"><Label>Präfix</Label><Input value={settings.ticket_number_prefix || "IT"} onChange={e => set("ticket_number_prefix", e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Muster</Label><Input value={settings.ticket_number_pattern || "{PREFIX}-{YEAR}-{NUM:4}"} onChange={e => set("ticket_number_pattern", e.target.value)} className="font-mono" /></div>
          </div>
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-2"><span className="text-xs text-muted-foreground">Vorschau:</span><span className="text-sm font-mono font-semibold">{(settings.ticket_number_pattern || "{PREFIX}-{YEAR}-{NUM:4}").replace(/\{PREFIX\}/gi, settings.ticket_number_prefix || "IT").replace(/\{YEAR\}/gi, String(new Date().getFullYear())).replace(/\{YY\}/gi, String(new Date().getFullYear()).slice(-2)).replace(/\{NUM:(\d+)\}/gi, (_, d) => "42".padStart(parseInt(d), "0")).replace(/\{NUM\}/gi, "42")}</span></div>
        </CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Bestellungen</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5"><Label>Präfix</Label><Input value={settings.order_number_prefix || "ORD"} onChange={e => set("order_number_prefix", e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Muster</Label><Input value={settings.order_number_pattern || "{PREFIX}-{YEAR}-{NUM:4}"} onChange={e => set("order_number_pattern", e.target.value)} className="font-mono" /></div>
          </div>
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-2"><span className="text-xs text-muted-foreground">Vorschau:</span><span className="text-sm font-mono font-semibold">{(settings.order_number_pattern || "{PREFIX}-{YEAR}-{NUM:4}").replace(/\{PREFIX\}/gi, settings.order_number_prefix || "ORD").replace(/\{YEAR\}/gi, String(new Date().getFullYear())).replace(/\{YY\}/gi, String(new Date().getFullYear()).slice(-2)).replace(/\{NUM:(\d+)\}/gi, (_, d) => "7".padStart(parseInt(d), "0")).replace(/\{NUM\}/gi, "7")}</span></div>
        </CardContent></Card>
      </div>
    </div>
  )

  // ─── Section: Email ───
  if (activeSection === "email") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="E-Mail-Versand" desc="SMTP-Server oder internes Mail-Gateway" />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>SMTP Host</Label><Input value={settings.smtp_host || ""} onChange={e => set("smtp_host", e.target.value)} placeholder="z.B. 10.90.120.254" /></div>
          <div className="space-y-1.5"><Label>Port</Label><Input value={settings.smtp_port || "25"} onChange={e => set("smtp_port", e.target.value)} placeholder="25" /></div>
        </div>
        <div className="space-y-1.5"><Label>Absender-Adresse</Label><Input value={settings.smtp_from || ""} onChange={e => set("smtp_from", e.target.value)} placeholder="helpdesk@firma.de" /><p className="text-xs text-muted-foreground">Wird als Absender für alle E-Mails verwendet.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Benutzername <span className="text-muted-foreground font-normal">(optional)</span></Label><Input value={settings.smtp_user || ""} onChange={e => set("smtp_user", e.target.value)} placeholder="Leer bei Gateway ohne Auth" /></div>
          <div className="space-y-1.5"><Label>Passwort <span className="text-muted-foreground font-normal">(optional)</span></Label><Input type="password" value={settings.smtp_pass || ""} onChange={e => set("smtp_pass", e.target.value)} placeholder="Leer bei Gateway ohne Auth" /></div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verschlüsselung</p>
          <div className="flex flex-wrap gap-3">
            {[{ value: "none", label: "Keine", desc: "Port 25 — internes Gateway" },{ value: "starttls", label: "STARTTLS", desc: "Port 587 — Standard" },{ value: "ssl", label: "SSL/TLS", desc: "Port 465 — Verschlüsselt" }].map(opt => {
              const active = (settings.smtp_secure || "none") === opt.value
              return (<button key={opt.value} type="button" onClick={() => { set("smtp_secure", opt.value); if (opt.value === "none" && !settings.smtp_port) set("smtp_port", "25"); if (opt.value === "starttls" && settings.smtp_port === "25") set("smtp_port", "587"); if (opt.value === "ssl" && (settings.smtp_port === "25" || settings.smtp_port === "587")) set("smtp_port", "465") }} className={`flex-1 min-w-[140px] rounded-lg border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-muted-foreground/30"}`}><p className={`text-sm font-medium ${active ? "text-primary" : ""}`}>{opt.label}</p><p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p></button>)
            })}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={() => set("smtp_reject_unauthorized", settings.smtp_reject_unauthorized === "false" ? "true" : "false")} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.smtp_reject_unauthorized === "false" ? "bg-primary" : "bg-muted-foreground/20"}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${settings.smtp_reject_unauthorized === "false" ? "translate-x-4.5" : "translate-x-0.5"}`} /></button>
            <span className="text-xs text-muted-foreground">Selbstsignierte Zertifikate akzeptieren</span>
          </div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test-Mail</p>
          <div className="flex items-center gap-2">
            <Input value={settings._test_mail_to || ""} onChange={e => set("_test_mail_to", e.target.value)} placeholder="empfaenger@firma.de" className="flex-1" />
            <Button variant="outline" size="sm" type="button" onClick={async () => { const to = (settings._test_mail_to || "").trim(); if (!to || !to.includes("@")) { alert("Bitte gültige E-Mail-Adresse eingeben"); return }; const res = await fetch("/api/settings/test-mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) }); const data = await res.json(); alert(data.success ? `Test-Mail an ${to} gesendet!` : `Fehler: ${data.error}`) }}><Mail className="h-3.5 w-3.5" /> Senden</Button>
          </div>
        </div>
      </CardContent></Card>
    </div>
  )

  // ─── Section: Nav visibility ───
  if (activeSection === "nav") return (
    <div className="animate-fade-in max-w-4xl">
      <SectionHeader title="Menü-Sichtbarkeit" desc="Dashboard und Einstellungen sind immer sichtbar. Admins sehen alles." />
      <Card><CardContent className="pt-6">
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b bg-muted/30">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide w-44">Menüpunkt</th>
            {ALL_ROLES.filter(r => r !== "admin").map(role => (<th key={role} className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">{ROLE_LABELS[role]}</th>))}
          </tr></thead><tbody className="divide-y">
            {configurableNavItems.map(item => (<tr key={item.key} className="hover:bg-muted/20 transition-colors"><td className="px-4 py-2 font-medium text-sm">{item.label}</td>
              {ALL_ROLES.filter(r => r !== "admin").map(role => { const active = isNavRoleActive(item.key, role); return (<td key={role} className="text-center px-2 py-2"><button onClick={() => toggleNavRole(item.key, role)} className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all ${active ? "bg-primary/15 text-primary hover:bg-primary/25" : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted"}`}>{active ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 block rounded border border-current opacity-40" />}</button></td>) })}
            </tr>))}
          </tbody></table>
        </div>
        {pluginItems.length > 0 && (<div className="mt-6 pt-5 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add-ons <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full ml-1">{pluginItems.length}</span></p>
          <div className="rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30"><th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide w-44">Add-on</th>
            {ALL_ROLES.filter(r => r !== "admin").map(role => (<th key={role} className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">{ROLE_LABELS[role]}</th>))}</tr></thead><tbody className="divide-y">
            {pluginItems.map(item => (<tr key={item.key} className="hover:bg-muted/20 transition-colors"><td className="px-4 py-2 font-medium text-sm">{item.label}</td>
              {ALL_ROLES.filter(r => r !== "admin").map(role => { const active = isNavRoleActive(item.key, role); return (<td key={role} className="text-center px-2 py-2"><button onClick={() => toggleNavRole(item.key, role)} className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all ${active ? "bg-primary/15 text-primary hover:bg-primary/25" : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted"}`}>{active ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 block rounded border border-current opacity-40" />}</button></td>) })}
            </tr>))}
          </tbody></table></div>
        </div>)}
        <p className="text-xs text-muted-foreground mt-3">Seiten bleiben per URL erreichbar — nur die Navigation wird ausgeblendet.</p>
      </CardContent></Card>
    </div>
  )

  // Onboarding settings live in the plugin at /p/onboarding/settings

  // ─── Section: Catalog ───
  if (activeSection === "catalog") return (
    <div className="animate-fade-in max-w-2xl">
      <SectionHeader title="Produktkatalog" desc="Welche Rollen dürfen Produkte im Katalog verwalten?" />
      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map(role => { const selected = (settings.catalog_manager_roles || "admin").split(",").map(r => r.trim()).includes(role); return (<button key={role} type="button" onClick={() => { const current = (settings.catalog_manager_roles || "admin").split(",").map(r => r.trim()).filter(Boolean); const next = selected ? current.filter(r => r !== role) : [...current, role]; set("catalog_manager_roles", next.join(",") || "admin") }} className={`rounded-full border px-3 py-1 text-sm font-medium transition-all ${selected ? "bg-primary/15 border-primary/40 text-primary" : "border-muted text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>{ROLE_LABELS[role]}</button>) })}
        </div>
        <p className="text-xs text-muted-foreground">Admins haben immer Zugriff.</p>
      </CardContent></Card>
    </div>
  )

  return null
}
