"use client"
import { useState, useEffect } from "react"
import { Loader2, Monitor, Smartphone, Tablet, Server, Printer, Cpu, Phone, Shield, Calendar, Hash, Tag, Building2, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; gradient: string }> = {
  windows: { label: "Windows", emoji: "🪟", gradient: "from-blue-600/20 to-blue-500/5" },
  android: { label: "Android", emoji: "🤖", gradient: "from-emerald-600/20 to-emerald-500/5" },
  ios: { label: "iOS / iPadOS", emoji: "🍎", gradient: "from-gray-500/20 to-gray-400/5" },
  other: { label: "Sonstiges", emoji: "📦", gradient: "from-muted to-muted/30" },
}

const STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  available: { label: "Verfügbar", variant: "success" },
  active: { label: "Aktiv", variant: "success" },
  assigned: { label: "Zugewiesen", variant: "info" },
  in_repair: { label: "In Reparatur", variant: "warning" },
  maintenance: { label: "Wartung", variant: "warning" },
  retired: { label: "Ausgemustert", variant: "destructive" },
}

const TYPE_ICONS: Record<string, any> = {
  laptop: Monitor, desktop: Monitor, phone: Smartphone, smartphone: Smartphone,
  tablet: Tablet, server: Server, printer: Printer, Laptop: Monitor, Desktop: Monitor,
  Smartphone: Smartphone, Tablet: Tablet, Server: Server, Drucker: Printer,
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  )
}

function DeviceCard({ device }: { device: any }) {
  const plat = PLATFORM_CONFIG[device.platform] || PLATFORM_CONFIG.other
  const status = STATUS_CONFIG[device.status] || { label: device.status, variant: "secondary" }
  const DeviceIcon = TYPE_ICONS[device.type] || Monitor

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow w-[340px] shrink-0 grow-0">
      {/* Header with gradient */}
      <div className={`bg-gradient-to-br ${plat.gradient} px-5 py-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-card/80 backdrop-blur flex items-center justify-center text-2xl shadow-sm">
              {plat.emoji}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                {device.friendly_name || device.name}
              </h3>
              {device.friendly_name && device.name !== device.friendly_name && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{device.name}</p>
              )}
            </div>
          </div>
          <Badge variant={status.variant as any} className="shrink-0">{status.label}</Badge>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-0.5">
        <InfoRow icon={Cpu} label="Hersteller / Modell"
          value={[device.manufacturer, device.model].filter(Boolean).join(" — ") || null} />
        <InfoRow icon={Hash} label="Seriennummer" value={device.serial_number} />
        <InfoRow icon={Tag} label="Asset-Tag" value={device.asset_tag} />
        <InfoRow icon={Shield} label="Betriebssystem" value={device.os_version ? `${plat.label} ${device.os_version}` : null} />
        <InfoRow icon={Phone} label="Telefonnummer" value={device.phone_number} />
        <InfoRow icon={FileText} label="IMEI" value={device.imei} />
        <InfoRow icon={Calendar} label="Inbetriebnahme" value={
          device.commissioned_at ? new Date(device.commissioned_at).toLocaleDateString("de-DE") : null
        } />
        <InfoRow icon={Calendar} label="Garantie bis" value={
          device.warranty_until ? new Date(device.warranty_until).toLocaleDateString("de-DE") : null
        } />
        <InfoRow icon={Building2} label="Händler" value={device.supplier_name} />
      </div>
    </div>
  )
}

export default function MyDevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/assets/my")
      .then(r => r.json())
      .then(data => setDevices(Array.isArray(data) ? data : []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false))
  }, [])

  const platforms = [...new Set(devices.map(d => d.platform || "other"))]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Meine Geräte</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ihnen zugewiesene IT-Geräte und Mobilgeräte
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Monitor className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">Keine Geräte zugewiesen</p>
          <p className="text-sm mt-1">Es sind Ihnen aktuell keine Geräte zugeordnet.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Geräte gesamt</p>
              <p className="text-2xl font-bold mt-0.5">{devices.length}</p>
            </div>
            {platforms.map(p => {
              const cfg = PLATFORM_CONFIG[p] || PLATFORM_CONFIG.other
              const count = devices.filter(d => (d.platform || "other") === p).length
              return (
                <div key={p} className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">{cfg.emoji} {cfg.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{count}</p>
                </div>
              )
            })}
          </div>

          {/* Device cards - all in one flow */}
          <div className="flex flex-wrap gap-4">
            {devices.map(d => (
              <DeviceCard key={d.id} device={d} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
