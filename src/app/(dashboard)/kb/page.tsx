"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, BookOpen, ThumbsUp, Eye, Loader2, X } from "lucide-react"

function NewArticleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState("draft")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError("Titel ist erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Neuer Artikel</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div>
            <label className="text-sm font-medium mb-1 block">Titel *</label>
            <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. VPN einrichten unter Windows" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">Entwurf</option>
              <option value="published">Veröffentlicht</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Inhalt</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={6}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Artikelinhalt..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Erstelle...</> : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function KBPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showNew, setShowNew] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    fetch(`/api/kb?${params}`)
      .then(r => r.json())
      .then(data => { setArticles(data.articles || data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wissensdatenbank</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Anleitungen und Lösungsartikel</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Neuer Artikel</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Artikel suchen..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Artikel vorhanden</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: any) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm leading-snug">{article.title}</h3>
                  <Badge variant={article.status === "published" ? "success" : "secondary"} className="shrink-0 text-xs">
                    {article.status === "published" ? "Veröff." : "Entwurf"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views || 0}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpful_votes || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showNew && <NewArticleModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
    </div>
  )
}
