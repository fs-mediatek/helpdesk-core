/**
 * Shared workflow step execution engine.
 * Extracts action-type logic into reusable functions for orders, onboarding, offboarding.
 */

export interface StepExecutionContext {
  stepId: number
  actionType: string // 'none', 'approval', 'cost_entry', 'asset_assign', 'access_code_gen', 'access_code_confirm'
  userId: number
  userName: string
  body: Record<string, any> // request body with action-specific data
}

export interface StepExecutionResult {
  success: boolean
  advance: boolean // should the workflow advance to next step?
  data?: Record<string, any>
  error?: string
}

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

/**
 * Execute an action type and return whether to advance.
 * Does NOT perform step advancement itself — only validates and executes
 * the action-specific logic, returning data the caller may need.
 */
export async function executeStepAction(ctx: StepExecutionContext): Promise<StepExecutionResult> {
  const { actionType, body } = ctx

  switch (actionType) {
    case "none":
      return { success: true, advance: true }

    case "approval":
      if (body.reject) {
        if (!body.reason) {
          return { success: false, advance: false, error: "Begründung erforderlich" }
        }
        return { success: true, advance: false, data: { rejected: true, reason: body.reason } }
      }
      return { success: true, advance: true, data: { approved: true, approved_by: ctx.userId } }

    case "cost_entry":
      if (body.total_cost === undefined && body.amount === undefined) {
        return { success: false, advance: false, error: "Kosten erforderlich" }
      }
      const cost = body.total_cost ?? body.amount
      return { success: true, advance: true, data: { total_cost: cost } }

    case "asset_assign":
      if (!body.asset_id) {
        return { success: false, advance: false, error: "Asset auswählen" }
      }
      return { success: true, advance: true, data: { asset_id: body.asset_id } }

    case "access_code_gen": {
      const code = generateAccessCode()
      return { success: true, advance: true, data: { access_code: code } }
    }

    case "access_code_confirm": {
      if (!body.code) {
        return { success: false, advance: false, error: "Zugangscode erforderlich" }
      }
      if (!body.expected_code) {
        return { success: false, advance: false, error: "Kein Zugangscode zum Vergleich vorhanden" }
      }
      if (body.code.trim().toUpperCase() !== (body.expected_code || "").toUpperCase()) {
        return { success: false, advance: false, error: "Zugangscode stimmt nicht überein" }
      }
      return { success: true, advance: true }
    }

    default:
      // Unknown action types just advance (treat as 'none')
      return { success: true, advance: true }
  }
}

/**
 * Advance a workflow: complete current active step, activate next pending step.
 *
 * @param table       Progress table name (e.g. 'order_progress_steps' or 'onboarding_step_progress')
 * @param idField     FK field name (e.g. 'order_id' or 'request_id')
 * @param idValue     FK value
 * @param completedBy User ID who completed the step
 * @param notes       Optional notes
 * @returns Whether all steps are now completed and the next step order if any
 */
export async function advanceWorkflow(
  table: string,
  idField: string,
  idValue: number,
  completedBy: number,
  notes?: string | null
): Promise<{ completed: boolean; nextStep?: number }> {
  const { query, pool } = await import("@/lib/db")

  // Find current active step
  const [activeStep] = await query(
    `SELECT * FROM ${table} WHERE ${idField} = ? AND status = 'active'`,
    [idValue]
  ) as any[]

  if (!activeStep) {
    return { completed: true }
  }

  // Complete the active step
  await pool.execute(
    `UPDATE ${table} SET status='completed', completed_at=NOW(), completed_by=?, notes=? WHERE id=?`,
    [completedBy, notes || null, activeStep.id]
  )

  // Find next pending step
  const [nextStep] = await query(
    `SELECT * FROM ${table} WHERE ${idField} = ? AND step_order > ? AND status = 'pending' ORDER BY step_order ASC LIMIT 1`,
    [idValue, activeStep.step_order]
  ) as any[]

  if (nextStep) {
    await pool.execute(
      `UPDATE ${table} SET status='active' WHERE id=?`,
      [nextStep.id]
    )
    return { completed: false, nextStep: nextStep.step_order }
  }

  // No more steps — all completed
  return { completed: true }
}
