export type MonthlyExecutivePoint = {
  month: string;
  revenueM: number;
  forecastM: number;
  marginPct: number;
  cashCycleDays: number;
  onTimeShipments: number;
  delayedShipments: number;
  inventoryTurnover: number;
  utilizationPct: number;
};

export type MarketContributionPoint = {
  country: string;
  revenueM: number;
  sharePct: number;
};

export type ProductMixPoint = {
  product: string;
  valueM: number;
};

export type CustomerRiskPoint = {
  customer: string;
  dependencyPct: number;
  paymentRiskPct: number;
  annualRevenueM: number;
};

export type UtilizationPoint = {
  hub: string;
  utilizationPct: number;
};

export type ExecutiveRadarPoint = {
  metric: string;
  score: number;
};

export const monthlyExecutiveSeries: MonthlyExecutivePoint[] = [
  { month: "Mar", revenueM: 2.1, forecastM: 2.0, marginPct: 22.4, cashCycleDays: 47, onTimeShipments: 86, delayedShipments: 14, inventoryTurnover: 4.1, utilizationPct: 74 },
  { month: "Apr", revenueM: 2.3, forecastM: 2.2, marginPct: 22.9, cashCycleDays: 45, onTimeShipments: 87, delayedShipments: 13, inventoryTurnover: 4.2, utilizationPct: 76 },
  { month: "May", revenueM: 2.4, forecastM: 2.3, marginPct: 23.6, cashCycleDays: 44, onTimeShipments: 88, delayedShipments: 12, inventoryTurnover: 4.4, utilizationPct: 77 },
  { month: "Jun", revenueM: 2.2, forecastM: 2.4, marginPct: 22.1, cashCycleDays: 49, onTimeShipments: 84, delayedShipments: 16, inventoryTurnover: 4.0, utilizationPct: 73 },
  { month: "Jul", revenueM: 2.6, forecastM: 2.5, marginPct: 24.2, cashCycleDays: 43, onTimeShipments: 89, delayedShipments: 11, inventoryTurnover: 4.6, utilizationPct: 80 },
  { month: "Aug", revenueM: 2.5, forecastM: 2.6, marginPct: 23.8, cashCycleDays: 42, onTimeShipments: 90, delayedShipments: 10, inventoryTurnover: 4.7, utilizationPct: 81 },
  { month: "Sep", revenueM: 2.7, forecastM: 2.6, marginPct: 24.5, cashCycleDays: 40, onTimeShipments: 91, delayedShipments: 9, inventoryTurnover: 4.9, utilizationPct: 83 },
  { month: "Oct", revenueM: 2.8, forecastM: 2.7, marginPct: 25.1, cashCycleDays: 39, onTimeShipments: 92, delayedShipments: 8, inventoryTurnover: 5.1, utilizationPct: 85 },
  { month: "Nov", revenueM: 2.9, forecastM: 2.8, marginPct: 25.0, cashCycleDays: 41, onTimeShipments: 90, delayedShipments: 10, inventoryTurnover: 5.0, utilizationPct: 84 },
  { month: "Dec", revenueM: 3.0, forecastM: 2.9, marginPct: 25.4, cashCycleDays: 38, onTimeShipments: 93, delayedShipments: 7, inventoryTurnover: 5.2, utilizationPct: 86 },
  { month: "Jan", revenueM: 2.8, forecastM: 3.0, marginPct: 24.6, cashCycleDays: 40, onTimeShipments: 89, delayedShipments: 11, inventoryTurnover: 4.8, utilizationPct: 82 },
  { month: "Feb", revenueM: 3.1, forecastM: 3.0, marginPct: 25.8, cashCycleDays: 37, onTimeShipments: 94, delayedShipments: 6, inventoryTurnover: 5.3, utilizationPct: 88 },
];

export const marketContributionMock: MarketContributionPoint[] = [
  { country: "Germany", revenueM: 0.88, sharePct: 28 },
  { country: "Netherlands", revenueM: 0.63, sharePct: 20 },
  { country: "United Kingdom", revenueM: 0.48, sharePct: 15 },
  { country: "France", revenueM: 0.41, sharePct: 13 },
  { country: "United States", revenueM: 0.36, sharePct: 12 },
  { country: "Japan", revenueM: 0.33, sharePct: 12 },
];

export const productMixMock: ProductMixPoint[] = [
  { product: "White Sugar", valueM: 1.22 },
  { product: "Refine Sugar", valueM: 0.94 },
  { product: "Raw Sugar", valueM: 0.52 },
  { product: "Liquid Sugar", valueM: 0.26 },
  { product: "Specialty Blend", valueM: 0.16 },
];

export const customerRiskMock: CustomerRiskPoint[] = [
  { customer: "Albion Laboratories", dependencyPct: 12, paymentRiskPct: 18, annualRevenueM: 0.42 },
  { customer: "Southasia Trade", dependencyPct: 18, paymentRiskPct: 21, annualRevenueM: 0.61 },
  { customer: "PT Sentra Usahatama", dependencyPct: 25, paymentRiskPct: 34, annualRevenueM: 0.73 },
  { customer: "Square Food", dependencyPct: 11, paymentRiskPct: 12, annualRevenueM: 0.31 },
  { customer: "PT Berkah Manis", dependencyPct: 16, paymentRiskPct: 28, annualRevenueM: 0.55 },
  { customer: "IFAD Multi Products", dependencyPct: 21, paymentRiskPct: 40, annualRevenueM: 0.68 },
  { customer: "Fine Food Traders", dependencyPct: 9, paymentRiskPct: 14, annualRevenueM: 0.27 },
  { customer: "PT Great Giant", dependencyPct: 14, paymentRiskPct: 25, annualRevenueM: 0.49 },
];

export const capacityUtilizationMock: UtilizationPoint[] = [
  { hub: "Bangkok", utilizationPct: 88 },
  { hub: "Jakarta", utilizationPct: 84 },
  { hub: "Ho Chi Minh", utilizationPct: 81 },
  { hub: "Dhaka", utilizationPct: 77 },
  { hub: "Rotterdam", utilizationPct: 72 },
];

export const executiveRadarMock: ExecutiveRadarPoint[] = [
  { metric: "Revenue", score: 82 },
  { metric: "Margin", score: 76 },
  { metric: "Liquidity", score: 73 },
  { metric: "Delivery", score: 88 },
  { metric: "Capacity", score: 79 },
  { metric: "Risk", score: 69 },
];
