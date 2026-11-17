import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const COLORS = ["#2d6cf5", "#27ae60", "#bb6bd9", "#f2994a", "#eb5757", "#2bb3c0"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: colorFor(name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
