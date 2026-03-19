"use client"
import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from "lucide-react"

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

/** Parse German date input: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD */
function parseInput(raw: string): { valid: boolean; iso: string } {
  const s = raw.trim()
  if (!s) return { valid: true, iso: "" }

  // Try DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const deMatch = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
  if (deMatch) {
    const [, dd, mm, yyyy] = deMatch
    const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy)
    if (m < 1 || m > 12 || d < 1 || d > getDaysInMonth(y, m - 1) || y < 1900 || y > 2100)
      return { valid: false, iso: "" }
    return { valid: true, iso: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` }
  }

  // Try YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch
    const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy)
    if (m < 1 || m > 12 || d < 1 || d > getDaysInMonth(y, m - 1) || y < 1900 || y > 2100)
      return { valid: false, iso: "" }
    return { valid: true, iso: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` }
  }

  return { valid: false, iso: "" }
}

function toDisplay(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso + "T00:00:00")
  if (isNaN(d.getTime())) return iso
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`
}

export function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [inputText, setInputText] = useState(toDisplay(value))
  const [error, setError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = new Date()
  const selected = value ? new Date(value + "T00:00:00") : null
  const [viewYear, setViewYear] = useState(selected?.getFullYear() || today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())

  // Sync display when value changes externally
  useEffect(() => {
    setInputText(toDisplay(value))
    setError(false)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0")
    const d = String(day).padStart(2, "0")
    const iso = `${viewYear}-${m}-${d}`
    onChange(iso)
    setInputText(toDisplay(iso))
    setError(false)
    setOpen(false)
  }

  const handleInputChange = (text: string) => {
    setInputText(text)
    setError(false)
  }

  const handleInputBlur = () => {
    if (!inputText.trim()) {
      onChange("")
      setError(false)
      return
    }
    const result = parseInput(inputText)
    if (result.valid && result.iso) {
      onChange(result.iso)
      setInputText(toDisplay(result.iso))
      setError(false)
      const d = new Date(result.iso + "T00:00:00")
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else if (result.valid && !result.iso) {
      onChange("")
      setError(false)
    } else {
      setError(true)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleInputBlur()
    }
    if (e.key === "Escape") {
      setInputText(toDisplay(value))
      setError(false)
      setOpen(false)
    }
  }

  const isToday = (day: number) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (day: number) => selected && day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear()

  return (
    <div className="relative" ref={ref}>
      <div className={`flex h-10 items-center rounded-lg border bg-background text-sm transition-colors overflow-hidden ${
        error ? "border-red-500 ring-1 ring-red-500/30" : "border-input focus-within:ring-2 focus-within:ring-ring"
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setError(false)}
          placeholder={placeholder || "TT.MM.JJJJ"}
          className="min-w-0 flex-1 h-full bg-transparent pl-3 pr-1 outline-none text-sm"
        />
        {error && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        <button type="button"
          onClick={() => { setOpen(o => !o); if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()) } }}
          className="h-full px-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 border-l bg-muted/30">
          <Calendar className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1">Ungültiges Datum. Format: TT.MM.JJJJ</p>}

      {open && (
        <div className="absolute z-50 top-full mt-2 w-72 rounded-xl border bg-card shadow-xl p-4 animate-fade-in">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))}
                className="bg-transparent text-sm font-semibold focus:outline-none cursor-pointer">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))}
                className="bg-transparent text-sm font-semibold focus:outline-none cursor-pointer">
                {Array.from({ length: 20 }, (_, i) => today.getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <button key={day} type="button" onClick={() => selectDay(day)}
                className={`h-8 w-full rounded-lg text-sm font-medium transition-all ${
                  isSelected(day)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isToday(day)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted text-foreground"
                }`}>
                {day}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <button type="button" onClick={() => { const t = new Date(); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); selectDay(t.getDate()) }}
              className="text-xs text-primary hover:underline font-medium">
              Heute
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(""); setInputText(""); setOpen(false) }}
                className="text-xs text-muted-foreground hover:text-foreground">
                Löschen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
