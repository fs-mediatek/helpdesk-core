"use client"
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { useState, useCallback } from "react"
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3,
  Link as LinkIcon, Image as ImageIcon, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, Minus, Unlink
} from "lucide-react"

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

function ToolbarButton({ onClick, active, disabled, children, title }: {
  onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md p-1.5 text-sm transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

export function RichEditor({ content, onChange, placeholder = "Schreibe hier...", editable = true }: RichEditorProps) {
  const [linkUrl, setLinkUrl] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState("")

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full my-4" },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-5 py-4",
      },
    },
  })

  const addLink = useCallback(() => {
    if (!editor || !linkUrl) return
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run()
    }
    setLinkUrl("")
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setImageUrl("")
    setShowImageInput(false)
  }, [editor, imageUrl])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/kb/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url }).run()
      }
    } catch {
      // fallback: use data URL
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          editor.chain().focus().setImage({ src: reader.result }).run()
        }
      }
      reader.readAsDataURL(file)
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Rückgängig">
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Wiederholen">
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Überschrift 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Überschrift 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Überschrift 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Fett">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Kursiv">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Unterstrichen">
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Durchgestrichen">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Code">
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Aufzählung">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Nummerierung">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Zitat">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Trennlinie">
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Linksbündig">
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Zentriert">
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Rechtsbündig">
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Link */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  const prev = editor.getAttributes("link").href || ""
                  setLinkUrl(prev)
                  setShowLinkInput(!showLinkInput)
                  setShowImageInput(false)
                }
              }}
              active={editor.isActive("link")}
              title={editor.isActive("link") ? "Link entfernen" : "Link einfügen"}
            >
              {editor.isActive("link") ? <Unlink className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            </ToolbarButton>
            {showLinkInput && (
              <div className="absolute left-0 top-full mt-1 z-20 flex items-center gap-1 rounded-lg border bg-card p-2 shadow-lg">
                <input
                  className="h-7 w-56 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addLink()}
                  autoFocus
                />
                <button onClick={addLink} className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">OK</button>
                <button onClick={() => setShowLinkInput(false)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground">×</button>
              </div>
            )}
          </div>

          {/* Image */}
          <div className="relative">
            <ToolbarButton
              onClick={() => { setShowImageInput(!showImageInput); setShowLinkInput(false) }}
              title="Bild einfügen"
            >
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>
            {showImageInput && (
              <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border bg-card p-3 shadow-lg space-y-2 w-72">
                <div className="flex items-center gap-1">
                  <input
                    className="h-7 flex-1 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Bild-URL eingeben..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addImage()}
                    autoFocus
                  />
                  <button onClick={addImage} className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">OK</button>
                </div>
                <div className="text-center text-xs text-muted-foreground">oder</div>
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Bild hochladen
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { handleImageUpload(f); setShowImageInput(false) }
                  }} />
                </label>
                <button onClick={() => setShowImageInput(false)} className="absolute top-1 right-2 text-muted-foreground hover:text-foreground text-xs">×</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  )
}

// Read-only HTML renderer
export function RichContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-a:text-primary prose-a:underline prose-a:underline-offset-2
        prose-img:rounded-lg prose-img:max-w-full
        prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1
        prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
        prose-hr:border-border"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
