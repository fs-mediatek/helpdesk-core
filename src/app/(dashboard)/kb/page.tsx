"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, BookOpen, ThumbsUp, Eye, Loader2, Trash2 } from "lucide-react"

export default function KBPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    fetch(`/api/kb?${params}`)
      .then(r => r.json())
      .then(data => { setArticles(data.articles || data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm("Artikel wirklich löschen?")) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/kb/${id}`, { method: "DELETE" })
      if (res.ok) load()
    } catch {}
    setDeleting(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wissensdatenbank</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Anleitungen und Lösungsartikel</p>
        </div>
        <Button onClick={() => router.push("/kb/new")}><Plus className="h-4 w-4" /> Neuer Artikel</Button>
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
          <p className="text-sm">{search ? "Keine Ergebnisse" : "Keine Artikel vorhanden"}</p>
          {!search && (
            <button onClick={() => router.push("/kb/new")} className="mt-3 text-sm text-primary hover:underline">
              Ersten Artikel erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: any) => (
            <Card
              key={article.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => router.push(`/kb/${article.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm leading-snug">{article.title}</h3>
                  <Badge variant={article.status === "published" ? "success" : "secondary"} className="shrink-0 text-xs">
                    {article.status === "published" ? "Veröff." : "Entwurf"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views || 0}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpful_votes || 0}</span>
                  </div>
                  <button
                    onClick={e => handleDelete(e, article.id)}
                    disabled={deleting === article.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Löschen"
                  >
                    {deleting === article.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
