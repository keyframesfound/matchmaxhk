export function Logo({
  className = "",
  imgClassName = "h-8 w-8",
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src="/matchmax-logo.png"
        alt="MatchMax logo"
        className={`logo-dark-recolor ${imgClassName} shrink-0 object-contain`}
      />
    </div>
  );
}
