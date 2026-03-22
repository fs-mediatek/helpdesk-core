"use client"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { RichEditor, RichContent } from "@/components/editor/rich-editor"
import {
  ArrowLeft, Save, Loader2, Eye, ThumbsUp, ThumbsDown,
  Pencil, Trash2, Clock, User, BookOpen
} from "lucide-react"

export default function KBArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [article, setArticle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState("draft")
  const [tags, setTags] = useState("")
  const [userRoles, setUserRoles] = useState<string[]>([])

  const isNew = id === "new"

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(me => {
      if (me?.role) setUserRoles(me.role.split(",").map((r: string) => r.trim()))
    })
  }, [])

  const canEdit = userRoles.some(r => ["admin", "agent"].includes(r))

  useEffect(() => {
    if (isNew) {
      setEditing(true)
      setLoading(false)
      return
    }
    fetch(`/api/kb/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setArticle(data)
        setTitle(data.title)
        setContent(data.content_html || "")
        setStatus(data.status || "draft")
        setTags(data.tags || "")
        // Increment view count
        fetch(`/api/kb/${id}/view`, { method: "POST" }).catch(() => {})
      })
      .catch(() => router.push("/kb"))
      .finally(() => setLoading(false))
  }, [id])

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const url = isNew ? "/api/kb" : `/api/kb/${id}`
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status, tags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (isNew && data.id) {
        router.replace(`/kb/${data.id}`)
      } else {
        setArticle({ ...article, title, content_html: content, status })
        setEditing(false)
      }
    } catch (e: any) {
      alert(e.message || "Fehler beim Speichern")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Artikel wirklich löschen?")) return
    try {
      await fetch(`/api/kb/${id}`, { method: "DELETE" })
      router.push("/kb")
    } catch {
      alert("Fehler beim Löschen")
    }
  }

  const vote = async (type: "helpful" | "unhelpful") => {
    try {
      await fetch(`/api/kb/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      // Refresh
      const res = await fetch(`/api/kb/${id}`)
      if (res.ok) setArticle(await res.json())
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/kb")}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {editing ? (
          <input
            className="flex-1 text-2xl font-bold bg-transparent border-b-2 border-primary/30 focus:border-primary focus:outline-none pb-1 transition-colors"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Artikeltitel..."
            autoFocus={isNew}
          />
        ) : (
          <h1 className="flex-1 text-2xl font-bold">{article?.title}</h1>
        )}

        {editing && (
          <select
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="draft">Entwurf</option>
            <option value="published">Veröffentlicht</option>
          </select>
        )}
      </div>

      {/* Tags input */}
      {editing && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 min-h-[36px] cursor-text" onClick={() => document.getElementById("tag-input")?.focus()}>
          {tags.split(",").map(t => t.trim()).filter(Boolean).map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
              {tag}
              <button type="button" className="hover:text-destructive" onClick={() => setTags(tags.split(",").map(t => t.trim()).filter((_, j) => j !== i).join(","))}>×</button>
            </span>
          ))}
          <input
            id="tag-input"
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
            placeholder={tags ? "" : "Tag eingeben + Enter"}
            onKeyDown={e => {
              const val = (e.target as HTMLInputElement).value.trim()
              if ((e.key === "Enter" || e.key === "Tab") && val) {
                e.preventDefault()
                const existing = tags.split(",").map(t => t.trim()).filter(Boolean)
                if (!existing.includes(val)) setTags([...existing, val].join(","))
                ;(e.target as HTMLInputElement).value = ""
              }
              if (e.key === "Backspace" && !val && tags) {
                const existing = tags.split(",").map(t => t.trim()).filter(Boolean)
                setTags(existing.slice(0, -1).join(","))
              }
            }}
          />
        </div>
      )}

      {/* Meta bar */}
      {article && !editing && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {new Date(article.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {article.views || 0} Aufrufe
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              article.status === "published" ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"
            }`}>
              {article.status === "published" ? "Veröffentlicht" : "Entwurf"}
            </span>
          </div>
          {article.tags && (
            <div className="flex flex-wrap gap-1">
              {article.tags.split(",").map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
                <span key={tag} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Speichere..." : "Speichern"}
            </button>
            {!isNew && (
              <button
                onClick={() => {
                  setTitle(article.title)
                  setContent(article.content_html || "")
                  setStatus(article.status)
                  setEditing(false)
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Abbrechen
              </button>
            )}
          </>
        ) : canEdit ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Pencil className="h-4 w-4" /> Bearbeiten
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Löschen
            </button>
          </>
        ) : null}
      </div>

      {/* Editor or Content */}
      {editing ? (
        <RichEditor
          content={content}
          onChange={setContent}
          placeholder="Schreibe deinen Artikel hier... Du kannst Überschriften, Listen, Links, Bilder und mehr verwenden."
        />
      ) : article?.content_html ? (
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <RichContent html={article.content_html} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border bg-card">
          <BookOpen className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Noch kein Inhalt vorhanden</p>
        </div>
      )}

      {/* Voting (only when viewing) */}
      {!editing && article && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium mb-3">War dieser Artikel hilfreich?</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => vote("helpful")}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-500 transition-colors"
            >
              <ThumbsUp className="h-4 w-4" /> Ja ({article.helpful_votes || 0})
            </button>
            <button
              onClick={() => vote("unhelpful")}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors"
            >
              <ThumbsDown className="h-4 w-4" /> Nein
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
