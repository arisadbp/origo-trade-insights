import { Globe2 } from "lucide-react";

type CountryFlagProps = {
  countryCode?: string | null;
  countryName?: string;
  className?: string;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-5 w-7",
  md: "h-6 w-9",
};

export function CountryFlag({ countryCode, countryName, className, size = "sm" }: CountryFlagProps) {
  const normalizedCode = (countryCode ?? "").trim().toUpperCase();
  const hasValidCode = /^[A-Z]{2}$/.test(normalizedCode);
  const flagUrl = hasValidCode ? `https://flagcdn.com/${normalizedCode.toLowerCase()}.svg` : "";
  const alt = hasValidCode ? `${countryName || normalizedCode} flag` : "Country";

  if (hasValidCode) {
    return (
      <img
        src={flagUrl}
        alt={alt}
        loading="lazy"
        className={`${sizeClasses[size]} rounded-[3px] border border-black/10 object-cover ${className ?? ""}`.trim()}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground ${size === "md" ? "h-6 w-9" : "h-5 w-7"} ${className ?? ""}`.trim()}
      aria-label="Unknown country"
      title="Unknown country"
    >
      <Globe2 className="h-3.5 w-3.5" />
    </span>
  );
}
