// Shared role types and fetch helper
export interface RoleDef {
  key_name: string
  label: string
  color: string | null
  is_builtin: number
  sort_order: number
}

let cachedRoles: RoleDef[] | null = null
let cacheTime = 0

export async function fetchRoles(): Promise<RoleDef[]> {
  // Client-side cache for 30s
  if (cachedRoles && Date.now() - cacheTime < 30_000) return cachedRoles
  try {
    const res = await fetch("/api/roles")
    if (!res.ok) return cachedRoles || []
    cachedRoles = await res.json()
    cacheTime = Date.now()
    return cachedRoles!
  } catch {
    return cachedRoles || []
  }
}

export function roleLabel(roles: RoleDef[], key: string): string {
  return roles.find(r => r.key_name === key)?.label || key
}

export function roleColor(roles: RoleDef[], key: string): string {
  return roles.find(r => r.key_name === key)?.color || "bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-800"
}
