'use client'
import type { HelpdeskPlugin } from '@/lib/plugins/types'

export function PluginPageWrapper({
  plugin,
  slug,
}: {
  plugin: HelpdeskPlugin
  slug: string[]
}) {
  const Component = plugin.Component!
  return (
    <div className="animate-fade-in">
      <Component slug={slug} />
    </div>
  )
}
