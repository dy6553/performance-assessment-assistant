export type IconName = "home" | "settings" | "chevron-left" | "check";

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      {name === "home" ? (
        <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
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
