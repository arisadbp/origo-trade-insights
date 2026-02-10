import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFlagEmoji } from "@/lib/flags";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface MapCountryDatum {
  code: string;
  name: string;
  flag: string;
  metricValue: number;
  share: number;
  importersCount?: number;
}

interface WorldMapProps {
  data: MapCountryDatum[];
  metricLabel: string;
  formatMetric: (value: number) => string;
  onCountryClick?: (countryCode: string) => void;
  selectedCountryCode?: string | null;
  dateRangeLabel?: string;
  enableHoverCard?: boolean;
  onViewCompanies?: (countryCode: string) => void;
  onClearSelection?: () => void;
  autoZoomKey?: string;
}

type HoverCountry = {
  code: string;
  name: string;
  flag: string;
  customers: number;
  metricValue: number;
  share: number;
};

function CountryHoverTooltip({
  country,
  dateRangeLabel,
  onViewCustomers,
}: {
  country: HoverCountry | null;
  dateRangeLabel?: string;
  onViewCustomers?: () => void;
}) {
  if (!country) return null;
  const hasData = country.customers > 0;

  return (
    <div className="w-[240px] rounded-2xl border bg-white p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{country.flag}</span>
        <div>
          <p className="text-sm font-semibold">
            {country.name} ({country.code})
          </p>
          <p className="text-xs text-muted-foreground leading-tight">{dateRangeLabel ?? ""}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg border bg-secondary/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">Customers</span>
          <span className="text-sm font-semibold">{country.customers}</span>
        </div>
        {hasData ? (
          <p className="text-xs text-muted-foreground">Click to see customers in this country</p>
        ) : (
          <p className="text-xs text-muted-foreground">No data for this selection</p>
        )}
      </div>

      <div className="mt-3">
        <Button
          variant="outline"
          className="h-8 w-full text-xs"
          disabled={!hasData}
          onClick={onViewCustomers}
        >
          {hasData ? "View customers" : "No data for this selection"}
        </Button>
      </div>
    </div>
  );
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
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.3;
const ZOOM_STEP = 0.2;

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

const getName = (properties?: Record<string, unknown>) => {
  if (!properties) return undefined;
  return (
    (properties.NAME as string | undefined) ??
    (properties.name as string | undefined) ??
    (properties.ADMIN as string | undefined) ??
    (properties["Country"] as string | undefined)
  );
};

const ringArea = (ring: number[][]) => {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
};

const getPrimaryRing = (geometry?: GeoGeometry | null) => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates[0] ?? [];

  let largestRing: number[][] = [];
  let largestArea = 0;
  geometry.coordinates.forEach((polygon) => {
    const ring = polygon[0] ?? [];
    const area = ringArea(ring);
    if (area > largestArea) {
      largestArea = area;
      largestRing = ring;
    }
  });
  return largestRing;
};

const getRingCentroid = (ring: number[][]) => {
  if (!ring.length) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  if (twiceArea === 0) {
    const sum = ring.reduce(
      (acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }),
      { lon: 0, lat: 0 },
    );
    return [sum.lon / ring.length, sum.lat / ring.length] as const;
  }

  return [cx / (3 * twiceArea), cy / (3 * twiceArea)] as const;
};

export function WorldMap({
  data,
  metricLabel,
  formatMetric,
  onCountryClick,
  selectedCountryCode,
  dateRangeLabel,
  enableHoverCard = true,
  onViewCompanies,
  onClearSelection,
  autoZoomKey,
}: WorldMapProps) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isAutoZooming, setIsAutoZooming] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [showFocusHint, setShowFocusHint] = useState(false);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverLock, setHoverLock] = useState(false);
  const [mobileTooltipCode, setMobileTooltipCode] = useState<string | null>(null);
  const [mobileTooltipOpen, setMobileTooltipOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeout = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const dragDistance = useRef(0);
  const dragHappened = useRef(false);

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

  const dataMap = useMemo(
    () => new Map(data.map((datum) => [datum.code.toUpperCase(), datum])),
    [data],
  );

  const countryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    features.forEach((feature) => {
      const code = getIso2(feature.properties);
      const name = getName(feature.properties);
      if (code && name) {
        map.set(code.toUpperCase(), name);
      }
    });
    return map;
  }, [features]);

  const dataCountryCodes = useMemo(
    () =>
      data
        .filter((datum) => datum.metricValue > 0 || (datum.importersCount ?? 0) > 0)
        .map((datum) => datum.code.toUpperCase()),
    [data],
  );

  const maxMetric = Math.max(0, ...data.map((datum) => datum.metricValue));
  const buildHoverCountry = (rawCode?: string | null): HoverCountry | null => {
    if (!rawCode) return null;
    const code = rawCode.toUpperCase();
    const datum = dataMap.get(code);
    if (datum) {
      return {
        code: datum.code,
        name: datum.name,
        flag: datum.flag,
        customers: datum.importersCount ?? 0,
        metricValue: datum.metricValue,
        share: datum.share,
      };
    }
    const fallbackName = countryNameMap.get(code) ?? code;
    return {
      code,
      name: fallbackName,
      flag: getFlagEmoji(code),
      customers: 0,
      metricValue: 0,
      share: 0,
    };
  };

  const hoveredCountry = useMemo<HoverCountry | null>(
    () => buildHoverCountry(hoveredCode),
    [hoveredCode, dataMap, countryNameMap],
  );
  const markerData = useMemo(() => {
    const featureByIso = new Map<string, GeoFeature>();
    features.forEach((feature) => {
      const iso2 = getIso2(feature.properties);
      if (iso2) featureByIso.set(iso2.toUpperCase(), feature);
    });

    return data
      .map((datum) => {
        const feature = featureByIso.get(datum.code.toUpperCase());
        if (!feature) return null;

        const ring = getPrimaryRing(feature.geometry);
        const center = getRingCentroid(ring);
        if (!center) return null;

        const [x, y] = project(center[0], center[1]);
        const customers = datum.importersCount ?? 0;

        return {
          ...datum,
          x,
          y,
          customers,
          label: customers > 99 ? "99+" : `${customers}`,
        };
      })
      .filter(Boolean) as Array<
      MapCountryDatum & {
        x: number;
        y: number;
        customers: number;
        label: string;
      }
    >;
  }, [data, features]);

  const renderedFeatures = useMemo(
    () =>
      features
        .map((feature, index) => {
          const path = geometryToPath(feature.geometry);
          if (!path) return null;

          const code = getIso2(feature.properties);
          const datum = code ? dataMap.get(code.toUpperCase()) : undefined;
          const intensity = datum && maxMetric > 0 ? datum.metricValue / maxMetric : 0;

          let fill = "#E5E7EB";
          if (intensity > 0.7) fill = "#5D8FD8";
          else if (intensity > 0.4) fill = "#8DB0E8";
          else if (intensity > 0.15) fill = "#BDD2F3";
          else if (intensity > 0) fill = "#DAE7F8";

          return {
            key: `${feature.id ?? index}`,
            code,
            path,
            fill,
          };
        })
        .filter(Boolean) as Array<{ key: string; code?: string; path: string; fill: string }>,
    [features, dataMap, maxMetric],
  );

  const centerX = VIEWBOX.width / 2;
  const centerY = VIEWBOX.height / 2;
  const transform = `translate(${pan.x + centerX - centerX * zoom} ${pan.y + centerY - centerY * zoom}) scale(${zoom})`;

  const hoveredMarker = hoveredCode
    ? markerData.find((marker) => marker.code === hoveredCode)
    : null;

  const updateHoverPositionFromPoint = (x: number, y: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setHoverPos({ x: x - rect.left, y: y - rect.top });
  };

  const updateHoverPositionFromMarker = (marker: { x: number; y: number }) => {
    if (!svgRef.current || !groupRef.current) return;
    const point = svgRef.current.createSVGPoint();
    point.x = marker.x;
    point.y = marker.y;
    const ctm = groupRef.current.getScreenCTM();
    if (!ctm) return;
    const screenPoint = point.matrixTransform(ctm);
    const rect = svgRef.current.getBoundingClientRect();
    setHoverPos({ x: screenPoint.x - rect.left, y: screenPoint.y - rect.top });
  };

  useEffect(() => {
    if (!hoveredMarker || !enableHoverCard) return;
    updateHoverPositionFromMarker(hoveredMarker);
  }, [hoveredMarker, zoom, pan, enableHoverCard]);

  useEffect(() => {
    if (!autoZoomKey) return;
    setUserHasInteracted(false);
    setShowFocusHint(false);
  }, [autoZoomKey]);

  useEffect(() => {
    if (!autoZoomKey) return;
    if (userHasInteracted) return;
    if (selectedCountryCode) return;
    if (!features.length) return;

    const codesSet = new Set(dataCountryCodes);
    if (codesSet.size === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setShowFocusHint(false);
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const updateBounds = (lon: number, lat: number) => {
      const [x, y] = project(lon, lat);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    };

    features.forEach((feature) => {
      const code = getIso2(feature.properties);
      if (!code || !codesSet.has(code.toUpperCase())) return;
      const geometry = feature.geometry;
      if (!geometry) return;
      if (geometry.type === "Polygon") {
        geometry.coordinates.forEach((ring) => ring.forEach(([lon, lat]) => updateBounds(lon, lat)));
      } else {
        geometry.coordinates.forEach((polygon) =>
          polygon.forEach((ring) => ring.forEach(([lon, lat]) => updateBounds(lon, lat))),
        );
      }
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return;
    }

    const padding = 46;
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const zoomX = (VIEWBOX.width - padding * 2) / boundsWidth;
    const zoomY = (VIEWBOX.height - padding * 2) / boundsHeight;
    let nextZoom = Math.min(zoomX, zoomY);
    nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));

    if (codesSet.size === 1) {
      nextZoom = Math.min(nextZoom, 1.8);
    }

    const centerBoundsX = (minX + maxX) / 2;
    const centerBoundsY = (minY + maxY) / 2;
    const nextPan = {
      x: (centerX - centerBoundsX) * nextZoom,
      y: (centerY - centerBoundsY) * nextZoom,
    };

    setIsAutoZooming(true);
    setZoom(nextZoom);
    setPan(nextPan);
    setShowFocusHint(true);

    const timer = window.setTimeout(() => setIsAutoZooming(false), 420);
    return () => window.clearTimeout(timer);
  }, [autoZoomKey, userHasInteracted, selectedCountryCode, features, dataCountryCodes, centerX, centerY]);

  const handleMarkerEnter = (code: string, event?: React.MouseEvent<SVGGElement>) => {
    if (!enableHoverCard) return;
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    if (event && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    hoverTimeout.current = window.setTimeout(() => {
      setHoveredCode(code);
    }, 120);
  };

  const handleMarkerLeave = () => {
    if (!enableHoverCard) return;
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    hoverTimeout.current = window.setTimeout(() => {
      if (!hoverLock) setHoveredCode(null);
    }, 140);
  };

  const handleHoverCardEnter = () => {
    if (!enableHoverCard) return;
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    setHoverLock(true);
  };

  const handleHoverCardLeave = () => {
    if (!enableHoverCard) return;
    setHoverLock(false);
    setHoveredCode(null);
  };

  const cardStyle = useMemo(() => {
    if (!hoverPos || !containerRef.current) return undefined;
    const rect = containerRef.current.getBoundingClientRect();
    const cardWidth = 240;
    const cardHeight = 150;
    let left = hoverPos.x + 14;
    let top = hoverPos.y - cardHeight - 14;
    if (left + cardWidth > rect.width - 8) {
      left = rect.width - cardWidth - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) {
      top = hoverPos.y + 14;
    }
    if (top + cardHeight > rect.height - 8) {
      top = rect.height - cardHeight - 8;
    }
    return { left, top };
  }, [hoverPos]);

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground">
        Missing <span className="mx-1 font-medium text-foreground">public/world-countries.geojson</span>
      </div>
    );
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = event.pointerId;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    dragDistance.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerId.current !== event.pointerId || !lastPoint.current) return;
    const dx = event.clientX - lastPoint.current.x;
    const dy = event.clientY - lastPoint.current.y;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    dragDistance.current += Math.abs(dx) + Math.abs(dy);
    if (dragDistance.current > 3) {
      dragHappened.current = true;
      if (!userHasInteracted) {
        setUserHasInteracted(true);
        setShowFocusHint(false);
      }
    }
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    lastPoint.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setTimeout(() => {
      dragHappened.current = false;
    }, 0);
  };

  const handleMarkerClick = (code: string) => {
    if (dragHappened.current) return;
    onCountryClick?.(code);
    if (!enableHoverCard) {
      setMobileTooltipCode(code);
      setMobileTooltipOpen(true);
    }
  };

  const handleCountryClick = (code?: string) => {
    if (!code || dragHappened.current) return;
    onCountryClick?.(code);
    if (!enableHoverCard) {
      setMobileTooltipCode(code);
      setMobileTooltipOpen(true);
    }
  };

  const handleCountryEnter = (code?: string, event?: React.MouseEvent<SVGPathElement>) => {
    if (!enableHoverCard || !code) return;
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    if (event) {
      const x = event.clientX;
      const y = event.clientY;
      if (x > 0 || y > 0) {
        updateHoverPositionFromPoint(x, y);
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        updateHoverPositionFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }
    hoverTimeout.current = window.setTimeout(() => {
      setHoveredCode(code);
    }, 120);
  };

  const handleCountryMove = (event?: React.MouseEvent<SVGPathElement>) => {
    if (!enableHoverCard || !event) return;
    updateHoverPositionFromPoint(event.clientX, event.clientY);
  };

  const handleCountryLeave = () => {
    if (!enableHoverCard) return;
    if (hoverTimeout.current) window.clearTimeout(hoverTimeout.current);
    hoverTimeout.current = window.setTimeout(() => {
      if (!hoverLock) setHoveredCode(null);
    }, 140);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-border/60 bg-slate-50"
    >
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-lg bg-white shadow-sm"
          onClick={() => {
            setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
            setUserHasInteracted(true);
            setShowFocusHint(false);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-lg bg-white shadow-sm"
          onClick={() => {
            setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
            setUserHasInteracted(true);
            setShowFocusHint(false);
          }}
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="h-full w-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#F8FAFC" />
        <g
          ref={groupRef}
          transform={transform}
          style={{ transition: isAutoZooming ? "transform 420ms ease" : "none" }}
        >
          {renderedFeatures.map((feature) => (
            <path
              key={feature.key}
              d={feature.path}
              fill={feature.fill}
              stroke="#F8FAFC"
              strokeWidth="0.35"
              className={feature.code ? "cursor-pointer transition-opacity hover:opacity-90" : "opacity-90"}
              role={feature.code ? "button" : "img"}
              tabIndex={feature.code ? 0 : -1}
              aria-label={
                feature.code
                  ? `View ${countryNameMap.get(feature.code.toUpperCase()) ?? feature.code}`
                  : "Country"
              }
              onClick={() => handleCountryClick(feature.code)}
              onMouseEnter={(event) => handleCountryEnter(feature.code, event)}
              onMouseMove={handleCountryMove}
              onMouseLeave={handleCountryLeave}
              onFocus={(event) => handleCountryEnter(feature.code, event as unknown as React.MouseEvent<SVGPathElement>)}
              onBlur={handleCountryLeave}
              onKeyDown={(event) => {
                if (!feature.code) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleCountryClick(feature.code);
                }
              }}
            />
          ))}

          {markerData.map((country) => {
            const isActive = selectedCountryCode === country.code;
            return (
              <g
                key={`marker-${country.code}`}
                className={`origo-marker ${isActive ? "is-active" : ""}`}
                onClick={() => handleMarkerClick(country.code)}
                onMouseEnter={(event) => handleMarkerEnter(country.code, event)}
                onMouseLeave={handleMarkerLeave}
              >
                <circle className="origo-marker-hit" cx={country.x} cy={country.y} r={18} />
                <circle className="origo-marker-ring" cx={country.x} cy={country.y} r={9} />
                <circle className="origo-marker-core" cx={country.x} cy={country.y} r={4} />
                <title>{country.label}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {enableHoverCard && hoveredCountry && cardStyle && (
        <div
          className="absolute z-30"
          style={{ left: cardStyle.left, top: cardStyle.top }}
          onMouseEnter={handleHoverCardEnter}
          onMouseLeave={handleHoverCardLeave}
        >
          <CountryHoverTooltip
            country={hoveredCountry}
            dateRangeLabel={dateRangeLabel}
            onViewCustomers={() => onViewCompanies?.(hoveredCountry.code)}
          />
        </div>
      )}

      {showFocusHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            Map is focused on countries with available data.
          </span>
        </div>
      )}

      {!enableHoverCard && mobileTooltipCode && (
        <Drawer open={mobileTooltipOpen} onOpenChange={setMobileTooltipOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Country Details</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <CountryHoverTooltip
                country={buildHoverCountry(mobileTooltipCode)}
                dateRangeLabel={dateRangeLabel}
                onViewCustomers={() => {
                  onViewCompanies?.(mobileTooltipCode);
                  setMobileTooltipOpen(false);
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <div className="sr-only">
        {metricLabel}: {formatMetric(data.reduce((sum, row) => sum + row.metricValue, 0))}
      </div>
    </div>
  );
}
