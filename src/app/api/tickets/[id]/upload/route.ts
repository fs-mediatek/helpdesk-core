import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 })

  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Nur Bilder (JPG, PNG, GIF, WebP) erlaubt" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || "jpg"
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir = join(process.cwd(), "uploads", "tickets", id)
  await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const filepath = join(dir, filename)
  await writeFile(filepath, buffer)

  const url = `/api/tickets/${id}/upload?file=${filename}`
  return NextResponse.json({ success: true, url })
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const filename = new URL(req.url).searchParams.get("file")
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Ungültig" }, { status: 400 })
  }

  const { readFile } = await import("fs/promises")
  const filepath = join(process.cwd(), "uploads", "tickets", id, filename)

  try {
    const data = await readFile(filepath)
    const ext = filename.split(".").pop()?.toLowerCase()
    const contentType: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp",
    }
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType[ext || ""] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  }
}
