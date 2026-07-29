import { Link } from "react-router-dom";

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({
  compact = false,
}: BrandMarkProps) {
  return (
    <Link
      to="/dashboard"
      className={
        compact
          ? "brand-mark brand-mark--compact"
          : "brand-mark"
      }
      aria-label="PromAI — на обзор"
    >
      {compact ? (
        "AI"
      ) : (
        <>
          <span>Prom</span>
          <span className="brand-mark__ai">AI</span>
        </>
      )}
    </Link>
  );
}
