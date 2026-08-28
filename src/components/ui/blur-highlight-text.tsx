type BlurHighlightTextProps = {
  children: string;
  highlights?: string[];
  className?: string;
  highlightClassName?: string;
  highlightColor?: string;
  blurAmount?: number;
  inactiveOpacity?: number;
};

/**
 * Renders emphasized page copy without applying animated blur or highlight
 * effects. The optional props remain supported so existing page composition
 * does not need to change.
 */
export function BlurHighlightText({ children, className }: BlurHighlightTextProps) {
  return <span className={className}>{children}</span>;
}
