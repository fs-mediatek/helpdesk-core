import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs"
import path from "path"

const UPLOAD_DIR = path.join(process.cwd(), "public", "kb-images")

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 })

  // Validate type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Nur Bilddateien erlaubt" }, { status: 400 })
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 })
  }

  ensureDir()

  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const filePath = path.join(UPLOAD_DIR, safeName)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  return NextResponse.json({ url: `/kb-images/${safeName}` })
}
