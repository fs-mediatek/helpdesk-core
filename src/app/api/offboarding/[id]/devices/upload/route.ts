import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type Ctx = { params: Promise<{ id: string }> }

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const deviceId = formData.get("device_id") as string | null
  const field = formData.get("field") as string | null

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 })
  if (!deviceId) return NextResponse.json({ error: "device_id erforderlich" }, { status: 400 })
  if (!field) return NextResponse.json({ error: "field erforderlich" }, { status: 400 })

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Nur JPG, PNG oder WebP erlaubt" }, { status: 400 })
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max 10 MB)" }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), "uploads", "offboarding", id, deviceId)
  fs.mkdirSync(uploadDir, { recursive: true })

  const timestamp = Date.now()
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const filename = `${field}_${timestamp}.${ext}`
  const filePath = path.join(uploadDir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  const url = `/api/offboarding/${id}/devices/upload?file=${encodeURIComponent(`offboarding/${id}/${deviceId}/${filename}`)}`

  return NextResponse.json({ url, field, filename })
}

export async function GET(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")

  const session = await getSession()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get("file")
  if (!filePath) return new NextResponse("Missing file param", { status: 400 })

  // Prevent path traversal
  const sanitized = filePath.replace(/\.\./g, "").replace(/\/\//g, "/")
  const fullPath = path.join(process.cwd(), "uploads", sanitized)

  if (!fullPath.startsWith(path.join(process.cwd(), "uploads"))) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const data = fs.readFileSync(fullPath)
  const ext = path.extname(fullPath).toLowerCase()
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"

  return new NextResponse(data, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  })
}
