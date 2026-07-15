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
  const image = compact ? (
    <Image
      src="/mark-512.png"
      alt="SeddleUp"
      width={512}
      height={512}
      priority={priority}
      className="h-9 w-9 object-contain"
      sizes="40px"
    />
  ) : (
    <>
      <Image
        src="/logo.png"
        alt="SeddleUp"
        width={1160}
        height={360}
        priority={priority}
        className="h-auto w-full object-contain dark:hidden"
        sizes="(min-width: 768px) 220px, 170px"
      />
      <Image
        src="/logo-dark.png"
        alt="SeddleUp"
        width={1160}
        height={360}
        priority={priority}
        className="hidden h-auto w-full object-contain dark:block"
        sizes="(min-width: 768px) 220px, 170px"
      />
    </>
  );

  const content = (
    <span
      className={[
        "inline-flex items-center text-ink",
        compact ? "h-11 w-11 max-w-full justify-center rounded-lg" : "w-44 max-w-full md:w-56",
        className
      ].join(" ")}
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
