import { cn } from "@/lib/utils";

type Props = { provider: string; className?: string; size?: number };

/** Simple brand marks (monochrome) for identity providers. */
export function ProviderIcon({ provider, className, size = 16 }: Props) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor", className: cn("shrink-0", className), "aria-hidden": true } as const;
  switch (provider) {
    case "instagram":
      return (
        <svg {...common}>
          <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.75a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1ZM17.9 7.1a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 8.2c-.07-1.5-.41-2.83-1.5-3.92S17.3 2.86 15.8 2.79C14.26 2.7 9.74 2.7 8.2 2.79c-1.5.07-2.82.41-3.92 1.5S2.86 6.7 2.79 8.2c-.09 1.54-.09 6.06 0 7.6.07 1.5.41 2.83 1.5 3.92s2.42 1.43 3.92 1.5c1.54.09 6.06.09 7.6 0 1.5-.07 2.83-.41 3.92-1.5s1.43-2.42 1.5-3.92c.09-1.54.09-6.06 0-7.6Zm-2 9.24a3.1 3.1 0 0 1-1.74 1.74c-1.2.48-4.06.37-5.26.37s-4.06.1-5.26-.37a3.1 3.1 0 0 1-1.74-1.74c-.48-1.2-.37-4.06-.37-5.26s-.1-4.06.37-5.26A3.1 3.1 0 0 1 6.74 5.2c1.2-.48 4.06-.37 5.26-.37s4.06-.1 5.26.37A3.1 3.1 0 0 1 19 6.94c.48 1.2.37 4.06.37 5.26s.11 4.06-.37 5.24Z" />
        </svg>
      );
    case "shopify":
      return (
        <svg {...common}>
          <path d="M15.34 3.6c-.1-.08-.2-.05-.28-.02l-.62.2c-.32-.98-.94-1.9-2.05-1.9h-.1c-.3-.4-.7-.58-1.04-.58-2.6 0-3.84 3.25-4.23 4.9l-1.82.56c-.56.18-.58.2-.65.73L3.1 19.05 14.2 21l6.7-1.45L18.1 4.02c-.06-.28-.2-.4-.36-.42l-2.4 0ZM12.3 5.2l-2.02.63c.36-1.36 1.03-2.9 2.16-2.9.15 0 .3.05.45.14-.26.55-.5 1.28-.6 2.13Zm-.8-3.1c.1 0 .2.03.28.1-1.2.56-2.5 1.98-3.03 4.8l-1.6.5c.45-1.5 1.5-5.4 4.35-5.4Zm2.06 2.82v-.2c0-.66-.1-1.2-.24-1.62.56.07.94.7 1.18 1.4l-.94.42Z" />
          <path d="M14.9 9.55s-.9-.48-1.98-.48c-1.6 0-1.68.98-1.68 1.24 0 1.37 3.6 1.9 3.6 5.1 0 2.55-1.62 4.18-3.8 4.18-2.6 0-3.95-1.62-3.95-1.62l.7-2.3s1.37 1.18 2.53 1.18c.76 0 1.07-.6 1.07-1.03 0-1.8-2.95-1.87-2.95-4.83 0-2.5 1.8-4.9 5.4-4.9 1.4 0 2.08.4 2.08.4l-1.02 3.06Z" fill="#fff" fillOpacity=".9" />
        </svg>
      );
    case "spotify":
      return (
        <svg {...common}>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.77-.96a.62.62 0 1 1-.28-1.22c3.8-.87 7.06-.5 9.7 1.12.3.18.4.57.2.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.7-1.65-6.8-2.13-9.98-1.17a.78.78 0 1 1-.45-1.5c3.64-1.1 8.16-.57 11.24 1.33.37.23.48.71.26 1.08Zm.1-2.84C14.7 8.92 9.35 8.74 6.26 9.68a.93.93 0 1 1-.54-1.79c3.54-1.08 9.43-.87 13.15 1.34a.93.93 0 0 1-.95 1.6Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.6 2.6 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.66a5.7 5.7 0 0 0-.8-.06 5.7 5.7 0 0 0-5.7 5.7 5.7 5.7 0 0 0 5.7 5.7 5.7 5.7 0 0 0 5.7-5.7V9.02a7.35 7.35 0 0 0 4.3 1.38V7.32a4.3 4.3 0 0 1-3.16-1.5Z" />
        </svg>
      );
    case "ticketmaster":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 0 0 0-3V7Zm5 1v8h1.5V8H9Zm4.5 2.5v3h1.5v-3h-1.5Z" />
        </svg>
      );
    case "email":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export const PROVIDER_LABELS: Record<string, string> = {
  instagram: "Instagram",
  shopify: "Shopify",
  spotify: "Spotify",
  tiktok: "TikTok",
  ticketmaster: "Ticketmaster",
  email: "Email",
  phone: "Phone",
  discord: "Discord",
  superfan: "Superfan",
  csv: "Import",
  manual: "Manual",
};
