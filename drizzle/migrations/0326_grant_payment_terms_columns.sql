GRANT SELECT (payment_terms), INSERT (payment_terms), UPDATE (payment_terms) ON TABLE public.quotes TO authenticated;
GRANT SELECT (installments_count, installments_due_day, validity_days, payment_method, payment_notes, payment_terms),
      INSERT (installments_count, installments_due_day, validity_days, payment_method, payment_notes, payment_terms),
      UPDATE (installments_count, installments_due_day, validity_days, payment_method, payment_notes, payment_terms)
  ON TABLE public.proposals TO authenticated;