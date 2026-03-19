// ============================================================
// AUTO-GENERATED — do not edit manually
// Use: npm run plugin install <package-name>
//      npm run plugin remove <package-name>
//      npm run plugin list
// ============================================================
import type { HelpdeskPlugin } from '@/lib/plugins/types'

// BEGIN_PLUGIN_IMPORTS
import assetsPlugin from '@helpdesk/plugin-assets' // plugin:@helpdesk/plugin-assets
import ticketAnalyticsPlugin from '@helpdesk/plugin-ticket-analytics' // plugin:@helpdesk/plugin-ticket-analytics
import systemMaintenancePlugin from '@helpdesk/plugin-system-maintenance' // plugin:@helpdesk/plugin-system-maintenance
import mobileContractsPlugin from '@helpdesk/plugin-mobile-contracts' // plugin:@helpdesk/plugin-mobile-contracts
import networkMonitorPlugin from '@helpdesk/plugin-network-monitor' // plugin:@helpdesk/plugin-network-monitor
import onboardingPlugin from '@helpdesk/plugin-onboarding' // plugin:@helpdesk/plugin-onboarding
// END_PLUGIN_IMPORTS

export const plugins: HelpdeskPlugin[] = [
// BEGIN_PLUGIN_LIST
  assetsPlugin,
  ticketAnalyticsPlugin,
  systemMaintenancePlugin,
  mobileContractsPlugin,
  networkMonitorPlugin,
  onboardingPlugin,
// END_PLUGIN_LIST
]
