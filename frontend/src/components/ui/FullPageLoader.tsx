import { BrandMark } from "./BrandMark";

interface FullPageLoaderProps {
  label: string;
}

export function FullPageLoader({
  label,
}: FullPageLoaderProps) {
  return (
    <div
      className="full-page-loader"
      role="status"
      aria-live="polite"
    >
      <BrandMark />
      <span className="loading-spinner" />
      <span>{label}…</span>
    </div>
  );
}
