export type IconName =
  | "home"
  | "sparkles"
  | "document"
  | "presentation"
  | "flask"
  | "history"
  | "calendar"
  | "bell"
  | "close"
  | "settings"
  | "chevron-left"
  | "check";

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      {name === "home" ? (
        <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      ) : name === "sparkles" ? (
        <>
          <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M18.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM5.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
        </>
      ) : name === "document" ? (
        <>
          <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
          <path d="M14 3v5h5M9 12h6M9 16h6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      ) : name === "presentation" ? (
        <>
          <rect x="4" y="4" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M12 15v5M8.5 20h7M8 8h8M8 11h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      ) : name === "flask" ? (
        <>
          <path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M7.5 16h9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      ) : name === "history" ? (
        <>
          <path d="M4 6v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M5.5 10.5A7.5 7.5 0 1 1 6 16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M12 8v4l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </>
      ) : name === "calendar" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      ) : name === "bell" ? (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M10 21h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      ) : name === "close" ? (
        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      ) : name === "settings" ? (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <circle cx="9" cy="6" fill="currentColor" r="2" />
          <circle cx="15" cy="12" fill="currentColor" r="2" />
          <circle cx="8" cy="18" fill="currentColor" r="2" />
        </>
      ) : name === "chevron-left" ? (
        <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      ) : (
        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      )}
    </svg>
  );
}
