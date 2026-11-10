/**
 * CONDICOES-PAGAMENTO — ativação do serviço sem I/O próprio.
 * Contrato com condições válidas → cronograma de contas a receber (uma vez por
 * contrato); sem condições → cobrança própria do serviço, como antes.
 * Uma recusa de autorização do banco NUNCA cai na cobrança antiga.
 */
import { activationSchedule, type ActivationScheduleItem } from "./activation-terms";

export interface ServiceActivationStore<S> {
  readService(id: string): Promise<{ contract_id: string | null; starts_at: string | null } | null>;
  readContract(id: string): Promise<{
    payment_terms: unknown;
    total_value: number | null;
    signed_at: string | null;
  } | null>;
  activateWithTerms(id: string, start: string, schedule: ActivationScheduleItem[]): Promise<S>;
  activateLegacy(id: string, startsAt: string | null): Promise<S>;
}

export async function activateServiceCore<S>(
  store: ServiceActivationStore<S>,
  serviceId: string,
  startsAt: string | null,
  today: string,
): Promise<S> {
  const svc = await store.readService(serviceId);
  if (svc?.contract_id) {
    const ct = await store.readContract(svc.contract_id);
    const start = startsAt ?? svc.starts_at ?? today;
    const schedule = ct
      ? activationSchedule(ct.payment_terms, ct.total_value, start, ct.signed_at)
      : null;
    if (schedule) return store.activateWithTerms(serviceId, start, schedule);
  }
  return store.activateLegacy(serviceId, startsAt);
}
