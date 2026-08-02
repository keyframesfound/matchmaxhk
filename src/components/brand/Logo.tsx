export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src="/matchmax-logo.png"
        alt="MatchMax logo"
        className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
      />
    </div>
  );
}
