import { Award, Crown, Flame, Map, Music, ShoppingBag, Sparkles, Star, Ticket, Users, type LucideProps } from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  ticket: Ticket,
  music: Music,
  flame: Flame,
  crown: Crown,
  map: Map,
  "shopping-bag": ShoppingBag,
  users: Users,
  star: Star,
  sparkles: Sparkles,
  award: Award,
};

/** Lucide icon for a badge's `icon` key, falling back to Award. */
export function BadgeIcon({ icon, ...props }: { icon: string } & LucideProps) {
  const Icon = ICONS[icon] ?? Award;
  return <Icon {...props} />;
}

export const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};
