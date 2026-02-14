import { useEffect, useMemo, useState } from "react";
import { getFlagEmoji } from "@/lib/flags";

type TopMarketPoint = {
  code: string;
  country: string;
  share: number;
};

interface TopMarketsWorldMapProps {
  data: TopMarketPoint[];
}

type GeoGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type GeoFeature = {
  type: "Feature";
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: GeoGeometry | null;
};

type GeoJson = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

const VIEWBOX = { width: 1000, height: 460 };

const project = (lon: number, lat: number) => {
  const x = ((lon + 180) / 360) * VIEWBOX.width;
  const y = ((90 - lat) / 180) * VIEWBOX.height;
  return [x, y] as const;
};

const ringToPath = (ring: number[][]) =>
  ring
    .map(([lon, lat], index) => {
      const [x, y] = project(lon, lat);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

const polygonToPath = (coords: number[][][]) => coords.map((ring) => `${ringToPath(ring)} Z`).join(" ");

const geometryToPath = (geometry?: GeoGeometry | null) => {
  if (!geometry) return "";
  if (geometry.type === "Polygon") return polygonToPath(geometry.coordinates);
  return geometry.coordinates.map((polygon) => polygonToPath(polygon)).join(" ");
};

const getIso2 = (properties?: Record<string, unknown>) => {
  if (!properties) return undefined;
  const candidate =
    (properties.ISO_A2 as string | undefined) ??
    (properties.iso_a2 as string | undefined) ??
    (properties.ISO2 as string | undefined) ??
    (properties.iso2 as string | undefined) ??
    (properties["ISO3166-1-Alpha-2"] as string | undefined) ??
    (properties["Alpha-2"] as string | undefined);
  if (!candidate || candidate === "-99") return undefined;
  return String(candidate).toUpperCase();
};

const TOP10_PALETTE = [
  "#1e3a8a",
  "#1d4ed8",
  "#2563eb",
  "#3b82f6",
  "#4f90f8",
  "#60a5fa",
  "#7ab8fb",
  "#93c5fd",
  "#b0d6ff",
  "#cbe3ff",
];

export function TopMarketsWorldMap({ data }: TopMarketsWorldMapProps) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [hoverCode, setHoverCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/world-countries.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Map data not found");
        return res.json();
      })
      .then((json: GeoJson) => {
        if (!active) return;
        setFeatures(json.features ?? []);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const rankedTop10 = useMemo(
    () => [...data].sort((a, b) => b.share - a.share).slice(0, 10),
    [data],
  );

  const rankMap = useMemo(
    () =>
      new Map(
        rankedTop10.map((item, index) => [
          item.code.toUpperCase(),
          { ...item, rank: index + 1 },
        ]),
      ),
    [rankedTop10],
  );

  const renderedFeatures = useMemo(
    () =>
      features
        .map((feature, index) => {
          const path = geometryToPath(feature.geometry);
          if (!path) return null;
          const code = getIso2(feature.properties);
          const ranked = code ? rankMap.get(code.toUpperCase()) : undefined;
          const fill = ranked ? TOP10_PALETTE[Math.min(9, ranked.rank - 1)] : "#e5e7eb";

          return {
            key: `${feature.id ?? index}`,
            code,
            path,
            fill,
            ranked,
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        code?: string;
        path: string;
        fill: string;
        ranked?: { code: string; country: string; share: number; rank: number };
      }>,
    [features, rankMap],
  );

  const hovered = hoverCode ? rankMap.get(hoverCode) : undefined;

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-xs text-muted-foreground">
        Missing map file
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="h-[250px] w-full overflow-hidden rounded-xl border border-border/60 bg-slate-50">
        <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#f8fafc" />
          {renderedFeatures.map((feature) => (
            <path
              key={feature.key}
              d={feature.path}
              fill={feature.fill}
              stroke="#ffffff"
              strokeWidth="0.45"
              className={feature.ranked ? "transition-opacity hover:opacity-85" : ""}
              onMouseEnter={() => setHoverCode(feature.code?.toUpperCase() ?? null)}
              onMouseLeave={() => setHoverCode(null)}
            >
              {feature.ranked && (
                <title>
                  #{feature.ranked.rank} {feature.ranked.country}: {feature.ranked.share.toFixed(1)}%
                </title>
              )}
            </path>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1e3a8a]" />
          <span>Top 1 (darkest)</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#cbe3ff]" />
          <span>Top 10 (lightest)</span>
        </div>
        {hovered && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-0.5 text-foreground">
            <span>{getFlagEmoji(hovered.code)}</span>
            <span>
              #{hovered.rank} {hovered.country} {hovered.share.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

