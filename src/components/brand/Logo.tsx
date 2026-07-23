export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient shadow-teal">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-white"
          aria-hidden
        >
          <path d="M4 17L10 11L14 15L20 7" />
          <path d="M14 7H20V13" />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-brand-gradient">
        MatchMax
      </span>
    </div>
  );
}
