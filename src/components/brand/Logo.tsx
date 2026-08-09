export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src="/matchmax-logo.png"
        alt="MatchMax logo"
        className="h-8 w-8 shrink-0 object-contain"
      />
    </div>
  );
}
