"use client"
import { useState, useRef, useEffect } from "react"
import { FileText, Search, Loader2, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Template {
  id: number
  name: string
  content: string
  category: string
}

interface TemplateSelectorProps {
  type: "answer" | "email" | "checklist"
  onSelect: (template: { id: number; name: string; content: string; category: string }) => void
  buttonLabel?: string
  buttonVariant?: "outline" | "ghost"
  size?: "sm" | "default"
}

export function TemplateSelector({
  type,
  onSelect,
  buttonLabel = "Vorlage einfügen",
  buttonVariant = "outline",
  size = "sm",
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const fetchTemplates = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    setSearch("")
    try {
      const res = await fetch(`/api/templates?type=${type}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.data || []
      setTemplates(list.map((t: any) => ({
        id: t.id,
        name: t.title || t.name,
        content: t.content,
        category: t.category || "",
      })))
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
  )

  const grouped: Record<string, Template[]> = {}
  for (const t of filtered) {
    const cat = t.category || "Sonstige"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(t)
  }
  const categories = Object.keys(grouped).sort()

  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant={buttonVariant} size={size} onClick={fetchTemplates}>
        <FileText className="h-3.5 w-3.5" />
        {buttonLabel}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border bg-card shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-input bg-background pl-7 pr-7 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Vorlage suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Keine Vorlagen gefunden</p>
            ) : (
              categories.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">{cat}</p>
                  {grouped[cat].map(t => (
                    <button
                      key={t.id}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors flex flex-col gap-0.5"
                      onClick={() => { onSelect(t); setOpen(false) }}
                    >
                      <span className="font-medium truncate">{t.name}</span>
                      <span className="text-muted-foreground truncate">{t.content.slice(0, 60)}{t.content.length > 60 ? "..." : ""}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
