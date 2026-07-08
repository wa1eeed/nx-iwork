// Client-safe tool catalogue (ids + human labels) for permission pickers and
// capability displays. The actual tool SCHEMAS + handlers live in tools.ts
// (server-only, imports the DB). Keep this list in sync with AGENT_TOOLS there.
//
// `group` is the functional area (department) a capability belongs to — it drives
// the per-department permission matrix in the agent form. An agent can be granted
// capabilities from ANY area (cross-department), not just its own department.

export type ToolGroup =
  | 'sales'
  | 'catalog'
  | 'bookings'
  | 'support'
  | 'operations'
  | 'memory';

// Render order for the matrix.
export const TOOL_GROUPS: ToolGroup[] = [
  'sales',
  'catalog',
  'bookings',
  'support',
  'operations',
  'memory',
];

export const TOOL_CATALOG: { id: string; label: string; group: ToolGroup }[] = [
  { id: 'find_customer', label: 'Find customer', group: 'sales' },
  { id: 'create_lead', label: 'Create lead', group: 'sales' },
  { id: 'update_lead', label: 'Update lead', group: 'sales' },
  { id: 'create_order', label: 'Create order', group: 'sales' },
  { id: 'search_catalog', label: 'Search catalog', group: 'catalog' },
  { id: 'check_availability', label: 'Check availability', group: 'bookings' },
  { id: 'create_booking', label: 'Create booking', group: 'bookings' },
  { id: 'update_booking', label: 'Update booking', group: 'bookings' },
  { id: 'search_faq', label: 'Search FAQ', group: 'support' },
  { id: 'create_task', label: 'Create task', group: 'operations' },
  { id: 'update_task_status', label: 'Update task status', group: 'operations' },
  { id: 'request_approval', label: 'Request approval', group: 'operations' },
  { id: 'save_memory', label: 'Save memory', group: 'memory' },
];

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_CATALOG.map((t) => [t.id, t.label])
);
