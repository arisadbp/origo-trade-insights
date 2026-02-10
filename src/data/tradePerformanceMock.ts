export type TradePerformancePoint = {
  month: string;
  inventory: number;
  sales: number;
  capacity: number;
  gapInv: number;
  gapCap: number;
  overInventory: boolean;
};

const raw = [
  { month: "2025-03", inventory: 1280, sales: 1160, capacity: 1500 },
  { month: "2025-04", inventory: 1320, sales: 1380, capacity: 1540 },
  { month: "2025-05", inventory: 1260, sales: 1420, capacity: 1580 },
  { month: "2025-06", inventory: 1340, sales: 1310, capacity: 1600 },
  { month: "2025-07", inventory: 1400, sales: 1520, capacity: 1650 },
  { month: "2025-08", inventory: 1360, sales: 1280, capacity: 1620 },
  { month: "2025-09", inventory: 1380, sales: 1460, capacity: 1680 },
  { month: "2025-10", inventory: 1420, sales: 1580, capacity: 1720 },
  { month: "2025-11", inventory: 1440, sales: 1500, capacity: 1750 },
  { month: "2025-12", inventory: 1390, sales: 1350, capacity: 1700 },
  { month: "2026-01", inventory: 1460, sales: 1620, capacity: 1780 },
  { month: "2026-02", inventory: 1480, sales: 1400, capacity: 1800 },
];

export const tradePerformanceMock: TradePerformancePoint[] = raw.map((item) => {
  const gapInv = item.sales - item.inventory;
  const gapCap = item.sales - item.capacity;
  return {
    ...item,
    gapInv,
    gapCap,
    overInventory: gapInv > 0,
  };
});
