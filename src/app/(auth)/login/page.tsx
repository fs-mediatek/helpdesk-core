"use client"
import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Headphones, Loader2, Mail, KeyRound } from "lucide-react"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

/* ────────────────────────────────────────────────
   Animated particle canvas (network mesh)
   ──────────────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    let particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = []

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const count = Math.min(55, Math.floor((canvas.width * canvas.height) / 20000))
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.35 + 0.1,
      })
    }

    const isDark = document.documentElement.classList.contains("dark")
    const color = isDark ? "139,92,246" : "99,60,220" // violet

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.07
            ctx!.beginPath()
            ctx!.strokeStyle = `rgba(${color},${alpha})`
            ctx!.lineWidth = 0.5
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.stroke()
          }
        }
      }

      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${color},${p.o})`
        ctx!.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" />
}

/* ────────────────────────────────────────────────
   Floating tech icons (decorative)
   ──────────────────────────────────────────────── */
function FloatingIcons() {
  const icons = [
    { x: 8, y: 20, d: 0, s: 28, r: 15 },
    { x: 85, y: 15, d: 2, s: 22, r: -10 },
    { x: 12, y: 70, d: 4, s: 20, r: 20 },
    { x: 90, y: 65, d: 1, s: 26, r: -15 },
    { x: 50, y: 85, d: 3, s: 18, r: 8 },
    { x: 30, y: 12, d: 5, s: 24, r: -12 },
    { x: 70, y: 80, d: 2.5, s: 20, r: 18 },
  ]

  const shapes = [
    // Monitor
    <><rect x="3" y="2" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 19h8M12 15v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    // Headset
    <><path d="M4 15V11a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><rect x="2" y="14" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="18" y="14" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    // Shield
    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" fill="none"/><polyline points="9 12 11 14 15 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
    // Wifi
    <><path d="M5 12.55a11 11 0 0114 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M8.53 16.11a6 6 0 016.95 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill="currentColor"/></>,
    // Server
    <><rect x="2" y="2" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="2" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></>,
    // Ticket
    <><path d="M2 9a3 3 0 010-6h20a3 3 0 010 6" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 15a3 3 0 000 6h20a3 3 0 000-6" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 9v6M22 9v6" stroke="currentColor" strokeWidth="1.5"/><path d="M9 9v6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/></>,
    // Cpu
    <><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {icons.map((ic, i) => (
        <div
          key={i}
          className="login-float-icon absolute text-primary/[0.07] dark:text-primary/[0.06]"
          style={{
            left: `${ic.x}%`,
            top: `${ic.y}%`,
            width: ic.s,
            height: ic.s,
            animationDelay: `${ic.d}s`,
            transform: `rotate(${ic.r}deg)`,
          }}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%">{shapes[i % shapes.length]}</svg>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────
   Login form
   ──────────────────────────────────────────────── */
function LoginContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [showMicrosoft, setShowMicrosoft] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMounted(true)
    const msError = searchParams.get("error")
    if (msError) setError(decodeURIComponent(msError))

    fetch("/api/setup/check").then(r => r.json()).then(d => {
      if (d.db_ok && !d.has_users) router.push("/setup")
    }).catch(() => {})

    fetch("/api/auth/login-status").then(r => r.json()).then(d => {
      setShowPassword(d.show_password !== false)
      setShowMicrosoft(d.show_microsoft === true)
    }).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Anmeldung fehlgeschlagen")
      } else {
        router.push("/dashboard")
      }
    } catch {
      setError("Verbindungsfehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      {/* Layer 1: Animated gradient */}
      <div className="absolute inset-0 login-gradient bg-gradient-to-br from-primary/15 via-indigo-400/5 to-violet-600/15 dark:from-primary/10 dark:via-indigo-900/15 dark:to-violet-950/20" />
      <div className="absolute inset-0 bg-background/80 dark:bg-background/85" />

      {/* Layer 2: Grid */}
      <div className="absolute inset-0 login-grid opacity-[0.025] dark:opacity-[0.035]" />

      {/* Layer 3: Particles */}
      {mounted && <ParticleCanvas />}

      {/* Layer 4: Glow orbs */}
      <div className="absolute top-[10%] right-[15%] w-80 h-80 rounded-full bg-primary/8 login-orb blur-[100px]" />
      <div className="absolute bottom-[15%] left-[10%] w-64 h-64 rounded-full bg-violet-500/8 login-orb blur-[80px]" style={{ animationDelay: "3s" }} />
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-400/5 login-orb blur-[120px]" style={{ animationDelay: "6s" }} />

      {/* Layer 5: Floating icons */}
      <FloatingIcons />

      {/* Layer 6: Login card */}
      <div className="relative z-10 w-full max-w-sm space-y-6 login-entrance">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="login-logo relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 shadow-xl shadow-primary/30">
            <Headphones className="h-7 w-7 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />
          </div>
          <div className="login-title-fade">
            <h1 className="text-2xl font-bold tracking-tight">HelpDesk</h1>
            <p className="text-muted-foreground text-sm mt-1">IT Support & Asset Management</p>
          </div>
        </div>

        {/* Card */}
        <Card className="login-card-glow border-0 shadow-2xl shadow-black/5 dark:shadow-black/30 backdrop-blur-md bg-card/90 dark:bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Anmelden</CardTitle>
            <CardDescription>Bitte mit deinen Zugangsdaten anmelden.</CardDescription>
          </CardHeader>
          <CardContent>
            {showPassword && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-Mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9"
                      placeholder="admin@firma.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="password"
                      type="password"
                      className="pl-9"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg login-shake">{error}</p>
                )}
                <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Anmelden...</> : "Anmelden"}
                </Button>
              </form>
            )}

            {!showPassword && error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg login-shake mb-4">{error}</p>
            )}

            {showPassword && showMicrosoft && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">oder anmelden über</span>
                </div>
              </div>
            )}

            {showMicrosoft && (
              <Button
                type="button"
                variant={showPassword ? "outline" : "default"}
                className="w-full gap-2 h-10"
                onClick={() => { window.location.href = "/api/auth/ms-login" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Mit Microsoft anmelden
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60">
          IT Helpdesk System v0.9.3
        </p>
      </div>
    </div>
  )
}
