import logoAsset from "@/assets/matchmax-logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoAsset.url}
        alt="MatchMax logo"
        className="h-9 w-9 object-contain"
      />
      <span className="text-xl font-bold tracking-tight text-brand-gradient">
        MatchMax
      </span>
    </div>
  );
}
