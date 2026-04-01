export interface TriggerContext {
  ticket_nummer?: string
  ticket_titel?: string
  ersteller_name?: string
  ersteller_email?: string
  agent_name?: string
  agent_email?: string
  betroffener_name?: string
  betroffener_email?: string
  datum?: string
  betreff?: string
  // For assets
  geraet_name?: string
  geraet_tag?: string
  // For onboarding/offboarding
  mitarbeiter_name?: string
  mitarbeiter_email?: string
  abteilung?: string
  austrittsdatum?: string
}

export async function fireTemplateTrigger(event: string, context: TriggerContext): Promise<void> {
  try {
    const { query } = await import("@/lib/db")
    const { sendMail } = await import("@/lib/mailer")

    const templates = await query(
      "SELECT id, title, content, trigger_recipient FROM response_templates WHERE trigger_event = ? AND trigger_enabled = 1",
      [event]
    ) as any[]

    if (!templates || templates.length === 0) return

    for (const template of templates) {
      try {
        let content = template.content || ""
        let subject = template.title || ""

        // Replace all placeholders in content and subject
        const replacements: Record<string, string | undefined> = {
          "{{ticket_nummer}}": context.ticket_nummer,
          "{{ticket_titel}}": context.ticket_titel,
          "{{ersteller_name}}": context.ersteller_name,
          "{{ersteller_email}}": context.ersteller_email,
          "{{agent_name}}": context.agent_name,
          "{{agent_email}}": context.agent_email,
          "{{betroffener_name}}": context.betroffener_name,
          "{{betroffener_email}}": context.betroffener_email,
          "{{datum}}": context.datum,
          "{{betreff}}": context.betreff,
          "{{geraet_name}}": context.geraet_name,
          "{{geraet_tag}}": context.geraet_tag,
          "{{mitarbeiter_name}}": context.mitarbeiter_name,
          "{{mitarbeiter_email}}": context.mitarbeiter_email,
          "{{abteilung}}": context.abteilung,
          "{{austrittsdatum}}": context.austrittsdatum,
        }

        for (const [placeholder, value] of Object.entries(replacements)) {
          const replacement = value || ""
          content = content.split(placeholder).join(replacement)
          subject = subject.split(placeholder).join(replacement)
        }

        // Determine recipient
        const recipientField = (template.trigger_recipient || "").trim()
        let recipient: string | undefined

        if (recipientField === "{{ersteller}}") {
          recipient = context.ersteller_email
        } else if (recipientField === "{{agent}}") {
          recipient = context.agent_email
        } else if (recipientField === "{{betroffener}}") {
          recipient = context.betroffener_email
        } else if (recipientField === "{{mitarbeiter}}") {
          recipient = context.mitarbeiter_email
        } else if (recipientField) {
          recipient = recipientField
        }

        if (recipient) {
          await sendMail(recipient, subject, content)
        }
      } catch (err) {
        console.error(`[TemplateTrigger] Failed to process template ${template.id} for event ${event}:`, err)
      }
    }
  } catch (err) {
    console.error(`[TemplateTrigger] Failed to fire trigger for event ${event}:`, err)
  }
}
