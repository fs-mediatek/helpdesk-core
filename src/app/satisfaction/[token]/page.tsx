"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"

export default function SatisfactionPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticketInfo, setTicketInfo] = useState<{
    ticket_number: string
    title: string
    requester_name: string
    already_rated: boolean
  } | null>(null)

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/satisfaction/${token}`)
      .then(r => {
        if (!r.ok) throw new Error("not found")
        return r.json()
      })
      .then(data => {
        setTicketInfo(data)
        if (data.already_rated) setSubmitted(true)
      })
      .catch(() => setError("Dieser Bewertungslink ist ungültig oder abgelaufen."))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit() {
    if (rating === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/satisfaction/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error || "Fehler beim Speichern")
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.")
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Laden...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">😔</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bewertung nicht möglich</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Vielen Dank!</h1>
          <p className="text-gray-600">
            {ticketInfo?.already_rated
              ? "Sie haben bereits eine Bewertung abgegeben. Vielen Dank!"
              : "Ihre Bewertung wurde erfolgreich gespeichert. Vielen Dank für Ihr Feedback!"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-100 mb-4">
            <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Zufriedenheitsbewertung</h1>
          <p className="text-gray-600 mt-2">
            Wie zufrieden sind Sie mit der Lösung Ihres Tickets{" "}
            <strong>{ticketInfo?.ticket_number}</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-1">{ticketInfo?.title}</p>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 focus:outline-none"
            >
              <svg
                className={`h-10 w-10 ${
                  star <= (hoverRating || rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300 fill-gray-300"
                } transition-colors`}
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          ))}
        </div>

        {/* Rating labels */}
        <div className="flex justify-between text-xs text-gray-400 mb-6 px-2">
          <span>Sehr unzufrieden</span>
          <span>Sehr zufrieden</span>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kommentar (optional)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            placeholder="Möchten Sie uns etwas mitteilen?"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            rating === 0
              ? "bg-gray-300 cursor-not-allowed"
              : submitting
              ? "bg-indigo-400 cursor-wait"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {submitting ? "Wird gespeichert..." : "Bewertung absenden"}
        </button>

        {rating > 0 && rating <= 2 && (
          <p className="text-xs text-amber-600 mt-3 text-center">
            Bei einer negativen Bewertung wird das Ticket automatisch zur erneuten Bearbeitung geöffnet.
          </p>
        )}
      </div>
    </div>
  )
}
