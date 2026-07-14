import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  compact?: boolean;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({
  href,
  compact = false,
  priority = false,
  className = ""
}: BrandLogoProps) {
  const image = (
    <Image
      src={compact ? "/mark-512.png" : "/logo.png"}
      alt="SeddleUp"
      width={compact ? 512 : 1160}
      height={compact ? 512 : 360}
      priority={priority}
      className={compact ? "h-9 w-9 object-contain" : "h-auto w-full object-contain"}
      sizes={compact ? "40px" : "(min-width: 768px) 220px, 170px"}
    />
  );

  const content = (
    <span
      className={[
        "inline-flex items-center rounded-lg text-ink",
        compact
          ? "h-11 w-11 max-w-full justify-center shadow-soft"
          : "w-44 max-w-full px-2 py-1.5 shadow-soft md:w-56",
        className
      ].join(" ")}
      style={{ backgroundColor: "#ffffff" }}
    >
      {image}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} aria-label="SeddleUp home" className="inline-flex min-w-0 max-w-full">
      {content}
    </Link>
  );
}
