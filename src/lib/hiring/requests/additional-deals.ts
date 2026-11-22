import type { PreparationData } from "./types";
export const MAX_ADDITIONAL_DEALS = 20;
/** Local draft projection only; the save RPC and trigger remain authoritative. */
export function setPrimaryDeal(value: PreparationData, id: string | null): PreparationData {
  return {
    ...value,
    deal_id: id,
    additional_deal_ids: id ? value.additional_deal_ids.filter((d) => d !== id) : [],
  };
}
const usable = (value: PreparationData, id: string | null): id is string =>
  !!id && id !== value.deal_id && !value.additional_deal_ids.includes(id);
export function changeAdditionalDeal(
  value: PreparationData,
  current: string | null,
  id: string | null,
): PreparationData {
  const list = value.additional_deal_ids;
  if (current === null)
    return usable(value, id) && list.length < MAX_ADDITIONAL_DEALS
      ? { ...value, additional_deal_ids: [...list, id] }
      : value;
  if (!id) return { ...value, additional_deal_ids: list.filter((d) => d !== current) };
  return usable(value, id)
    ? { ...value, additional_deal_ids: list.map((d) => (d === current ? id : d)) }
    : value;
}
