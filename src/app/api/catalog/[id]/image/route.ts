import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  const formData = await req.formData()
  const file = formData.get("image") as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: "Keine Datei" }, { status: 400 })

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type)) return NextResponse.json({ error: "Nur JPEG, PNG, WebP oder GIF erlaubt" }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "jpg"
  const filename = `product-${id}-${Date.now()}.${ext}`
  const dir = join(process.cwd(), "public", "catalog-images")
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()))

  const url = `/catalog-images/${filename}`
  await query("UPDATE catalog SET image_url = ? WHERE id = ?", [url, id])
  return NextResponse.json({ url })
}
