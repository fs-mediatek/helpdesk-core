"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, ExternalLink, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface KBArticle {
  id: number
  title: string
  snippet: string
}

interface CustomResponse {
  id: number
  title: string
  answer: string
  link?: string
}

interface ChatMessage {
  role: "bot" | "user"
  text?: string
  articles?: KBArticle[]
  customResponses?: CustomResponse[]
  actions?: { label: string; action: string }[]
}

const DEFAULT_GREETING = "Hallo! Ich bin der IT-Assistent. Stelle mir eine Frage und ich suche nach einer Lösung."
const DEFAULT_FALLBACK = "Leider konnte ich keine passende Lösung finden. Möchtest du ein Ticket erstellen?"

export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [fallback, setFallback] = useState(DEFAULT_FALLBACK)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showDot, setShowDot] = useState(true)
  const [configLoaded, setConfigLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstUserMessage = useRef<string>("")

  // Load config on mount
  useEffect(() => {
    fetch("/api/chat/config")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.greeting) setGreeting(data.greeting)
        if (data?.fallback) setFallback(data.fallback)
        setConfigLoaded(true)
      })
      .catch(() => setConfigLoaded(true))
  }, [])

  // Set initial message once config is loaded
  useEffect(() => {
    if (configLoaded && messages.length === 0) {
      setMessages([{ role: "bot", text: greeting }])
    }
  }, [configLoaded, greeting])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleOpen() {
    setOpen(true)
    setShowDot(false)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    if (!firstUserMessage.current) {
      firstUserMessage.current = text
    }

    setInput("")
    setMessages((prev) => [...prev, { role: "user", text }])
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()

      const hasCustom = data.customResponses?.length > 0
      const hasKB = data.articles?.length > 0

      if (hasCustom || hasKB) {
        const newMessages: ChatMessage[] = []

        // Show custom responses first
        if (hasCustom) {
          newMessages.push({
            role: "bot",
            text: hasKB ? "Dazu habe ich folgende Informationen:" : "Dazu habe ich folgende Informationen:",
            customResponses: data.customResponses,
          })
        }

        // Then KB articles
        if (hasKB) {
          newMessages.push({
            role: "bot",
            text: hasCustom ? "Zusätzlich aus der Wissensdatenbank:" : "Ich habe folgende Artikel gefunden:",
            articles: data.articles,
          })
        }

        // Follow-up
        newMessages.push({
          role: "bot",
          text: "Hat dir das weitergeholfen?",
          actions: [
            { label: "Ja, danke!", action: "close" },
            { label: "Nein, Ticket erstellen", action: "ticket" },
          ],
        })

        setMessages((prev) => [...prev, ...newMessages])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: fallback,
            actions: [{ label: "Ticket erstellen", action: "ticket" }],
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut." },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleAction(action: string) {
    if (action === "close") {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Freut mich, dass ich helfen konnte! Bei weiteren Fragen bin ich hier." },
      ])
    } else if (action === "ticket") {
      const chatHistory = messages
        .filter((m) => m.text)
        .map((m) => `${m.role === "user" ? "Benutzer" : "Assistent"}: ${m.text}`)
        .join("\n")

      const subject = encodeURIComponent(`Chat: ${firstUserMessage.current}`)
      const description = encodeURIComponent(chatHistory)
      window.location.href = `/tickets?subject=${subject}&description=${description}`
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Bubble */}
      <button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl",
          open && "scale-0 opacity-0 pointer-events-none"
        )}
        aria-label="Chat öffnen"
      >
        <MessageCircle className="h-6 w-6" />
        {showDot && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-xl border bg-card shadow-2xl transition-all duration-200 origin-bottom-right",
          open ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
        style={{ height: "500px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl border-b bg-primary px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
            <span className="font-semibold text-primary-foreground">IT-Assistent</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors"
            aria-label="Chat schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.text && <p>{msg.text}</p>}

                {/* Custom Responses */}
                {msg.customResponses && msg.customResponses.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.customResponses.map((resp) => (
                      <div key={resp.id} className="rounded-md border bg-background p-2.5">
                        <p className="font-medium text-sm text-foreground mb-1">{resp.title}</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{resp.answer}</p>
                        {resp.link && (
                          <a
                            href={resp.link}
                            target={resp.link.startsWith("http") ? "_blank" : undefined}
                            className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Mehr erfahren
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* KB Article Cards */}
                {msg.articles && msg.articles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.articles.map((article) => (
                      <a
                        key={article.id}
                        href={`/kb/${article.id}`}
                        className="block rounded-md border bg-background p-2 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium text-sm text-foreground">{article.title}</span>
                          <BookOpen className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.snippet}</p>
                      </a>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.actions.map((action, j) => (
                      <button
                        key={j}
                        onClick={() => handleAction(action.action)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          action.action === "ticket"
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-background border text-foreground hover:bg-accent"
                        )}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frage eingeben..."
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              aria-label="Nachricht senden"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
