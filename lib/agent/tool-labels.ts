// Client-safe tool catalogue (ids + human labels) for permission pickers and
// capability displays. The actual tool SCHEMAS + handlers live in tools.ts
// (server-only, imports the DB). Keep this list in sync with AGENT_TOOLS there.

export const TOOL_CATALOG: { id: string; label: string }[] = [
  { id: 'search_catalog', label: 'Search catalog' },
  { id: 'search_faq', label: 'Search FAQ' },
  { id: 'find_customer', label: 'Find customer' },
  { id: 'create_lead', label: 'Create lead' },
  { id: 'update_lead', label: 'Update lead' },
  { id: 'create_order', label: 'Create order' },
  { id: 'check_availability', label: 'Check availability' },
  { id: 'create_booking', label: 'Create booking' },
  { id: 'update_booking', label: 'Update booking' },
  { id: 'create_task', label: 'Create task' },
  { id: 'update_task_status', label: 'Update task status' },
  { id: 'save_memory', label: 'Save memory' },
];

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_CATALOG.map((t) => [t.id, t.label])
);
