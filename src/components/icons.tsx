export type IconName = "home" | "settings";

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      {name === "home" ? (
        <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      ) : (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <circle cx="9" cy="6" fill="currentColor" r="2" />
          <circle cx="15" cy="12" fill="currentColor" r="2" />
          <circle cx="8" cy="18" fill="currentColor" r="2" />
        </>
      )}
    </svg>
  );
}
