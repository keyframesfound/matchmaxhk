export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 whitespace-nowrap ${className}`}>
      <img
        src="/matchmax-logo.png"
        alt="MatchMax logo"
        className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
      />
      <span className="text-lg font-bold tracking-tight text-brand-gradient sm:text-xl">
        MatchMax
      </span>
    </div>
  );
}
