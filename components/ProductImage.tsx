/* Plain <img> with a branded botanical placeholder when no image is set.
   Product images are local files, so next/image optimisation is skipped
   deliberately to keep the stack self-contained. */

export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-tint ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        <svg width="64" height="64" viewBox="0 0 44 44" fill="none" className="opacity-25">
          <path
            d="M22 9C22 9 13 16.5 13 24.5C13 30 17 34.5 22 34.5C27 34.5 31 30 31 24.5C31 16.5 22 9 22 9Z"
            fill="rgb(var(--brand))"
          />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
