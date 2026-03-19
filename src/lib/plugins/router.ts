/**
 * Matches a request like "GET /items/42" against route patterns like "GET /items/:id"
 * Returns the handler and extracted params, or null if no match.
 */
export function matchPluginRoute(
  routes: Record<string, Function>,
  method: string,
  path: string
): { handler: Function; params: Record<string, string> } | null {
  // Normalize path
  const reqPath = '/' + path.replace(/^\/+|\/+$/g, '')

  for (const [pattern, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = pattern.split(' ')
    if (routeMethod.toUpperCase() !== method.toUpperCase()) continue

    const paramNames: string[] = []
    const regexStr = routePath
      .replace(/:[a-zA-Z_]+/g, (match) => {
        paramNames.push(match.slice(1))
        return '([^/]+)'
      })
      .replace(/\//g, '\\/')

    const regex = new RegExp(`^${regexStr}$`)
    const match = reqPath.match(regex)
    if (!match) continue

    const params: Record<string, string> = {}
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1]
    })

    return { handler, params }
  }

  return null
}
