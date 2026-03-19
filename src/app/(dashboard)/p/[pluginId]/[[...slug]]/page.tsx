import { notFound } from 'next/navigation'
import { plugins } from '@/plugins/registry'

export default async function PluginPage({
  params,
}: {
  params: Promise<{ pluginId: string; slug?: string[] }>
}) {
  const { pluginId, slug } = await params
  const plugin = plugins.find(p => p.manifest.id === pluginId)
  if (!plugin?.Component) notFound()

  // Render the Component directly — never pass the plugin object (which contains
  // non-serializable API handler functions) as a prop to a Client Component.
  const Component = plugin.Component
  return (
    <div className="animate-fade-in">
      <Component slug={slug ?? []} />
    </div>
  )
}
