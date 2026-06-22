import {
  Package,
  Sparkles,
  Rocket,
  Bot,
  BarChart3,
  Shield,
  Globe,
  Megaphone,
  Headphones,
  Zap,
  Palette,
  Plug,
  type LucideIcon,
} from 'lucide-react';

// String → icon map so admin-chosen icon names (stored on the service) render
// without shipping every lucide icon. Falls back to Package.
const MAP: Record<string, LucideIcon> = {
  package: Package,
  sparkles: Sparkles,
  rocket: Rocket,
  bot: Bot,
  chart: BarChart3,
  shield: Shield,
  globe: Globe,
  megaphone: Megaphone,
  headphones: Headphones,
  zap: Zap,
  palette: Palette,
  plug: Plug,
};

export const SERVICE_ICONS = Object.keys(MAP);

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Package;
  return <Icon className={className} />;
}
