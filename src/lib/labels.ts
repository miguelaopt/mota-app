import type { AccountKind } from "./finance/accounts";
import type { CostKind, GearCategory, GearStatus, ItemPriority } from "./finance/goal";

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  available: "Disponível",
  invested: "Investido",
};

export const GEAR_CATEGORY_LABEL: Record<GearCategory, string> = {
  protection: "Proteção",
  comfort: "Conforto",
  aesthetic_performance: "Estética / performance",
  other: "Outro",
};

export const PRIORITY_LABEL: Record<ItemPriority, string> = {
  essential: "Essencial",
  later: "Depois",
};

export const GEAR_STATUS_LABEL: Record<GearStatus, string> = {
  to_buy: "Por comprar",
  bought: "Comprado",
};

export const COST_KIND_LABEL: Record<CostKind, string> = {
  one_off: "Custo da compra",
  monthly: "Custo mensal",
};
