// Slugs that may never be claimed as a company username, because they collide
// with platform routes, common subdomains, or would be confusing/abusable as a
// public landing-page URL (bznss.one/<slug>).
const RESERVED = new Set<string>([
  // platform / app routes
  'admin', 'api', 'app', 'dashboard', 'login', 'logout', 'signup', 'signin',
  'onboarding', 'settings', 'account', 'billing', 'auth', 'oauth', 'callback',
  'overview', 'agents', 'departments', 'customers', 'products', 'orders',
  'bookings', 'knowledge', 'tasks', 'chat', 'modules', 'invoices',
  // infra / common subdomains
  'www', 'mail', 'smtp', 'ftp', 'cdn', 'assets', 'static', 'img', 'images',
  'media', 'files', 'download', 'downloads', 'status', 'health', 'ping',
  'webhook', 'webhooks', 'cron', 'internal', 'public', 'private',
  // brand / generic
  'nx', 'iwork', 'nxiwork', 'bznss', 'support', 'help', 'docs', 'blog', 'about',
  'contact', 'pricing', 'terms', 'privacy', 'legal', 'security', 'company',
  'team', 'careers', 'jobs', 'store', 'shop', 'home', 'index', 'root', 'null',
  'undefined', 'test', 'demo', 'example', 'sample',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}
