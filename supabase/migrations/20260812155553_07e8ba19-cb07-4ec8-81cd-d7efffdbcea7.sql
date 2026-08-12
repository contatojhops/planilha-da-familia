CREATE OR REPLACE FUNCTION public.family_transactions_for_month(
  p_family_id uuid,
  p_month date
)
RETURNS TABLE (
  transaction_id uuid,
  origin_transaction_id uuid,
  description text,
  display_date date,
  amount numeric,
  type public.tx_type,
  status public.tx_status,
  category_id uuid,
  owner_id uuid,
  card_id uuid,
  payment_method public.payment_method,
  recurrence public.recurrence,
  installment_label text,
  is_projected boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM public.transactions
    WHERE family_id = p_family_id
  )
  -- 1) Lançamento único (sem recorrência)
  SELECT
    b.id,
    b.id,
    b.description,
    b.tx_date,
    b.amount,
    b.type,
    b.status,
    b.category_id,
    b.owner_id,
    b.card_id,
    b.payment_method,
    b.recurrence,
    NULL::text,
    FALSE
  FROM base b
  WHERE b.recurrence = 'none'
    AND date_trunc('month', b.tx_date)::date = v_month_start

  UNION ALL

  -- 2) Recorrência mensal
  SELECT
    b.id,
    b.id,
    b.description,
    (v_month_start + (extract(day from b.tx_date)::int - 1))::date,
    b.amount,
    b.type,
    b.status,
    b.category_id,
    b.owner_id,
    b.card_id,
    b.payment_method,
    b.recurrence,
    NULL::text,
    v_month_start <> date_trunc('month', b.tx_date)::date
  FROM base b
  WHERE b.recurrence = 'monthly'
    AND v_month_start >= date_trunc('month', b.tx_date)::date

  UNION ALL

  -- 3) Recorrência anual
  SELECT
    b.id,
    b.id,
    b.description,
    (v_month_start + (extract(day from b.tx_date)::int - 1))::date,
    b.amount,
    b.type,
    b.status,
    b.category_id,
    b.owner_id,
    b.card_id,
    b.payment_method,
    b.recurrence,
    NULL::text,
    v_month_start <> date_trunc('month', b.tx_date)::date
  FROM base b
  WHERE b.recurrence = 'yearly'
    AND v_month_start >= date_trunc('month', b.tx_date)::date
    AND extract(month from v_month_start) = extract(month from b.tx_date)

  UNION ALL

  -- 4) Parcelado: parcela atual = parcela de origem + meses decorridos
  SELECT
    b.id,
    b.id,
    b.description,
    (v_month_start + (extract(day from b.tx_date)::int - 1))::date,
    b.amount,
    b.type,
    b.status,
    b.category_id,
    b.owner_id,
    b.card_id,
    b.payment_method,
    b.recurrence,
    (
      (coalesce(b.installment_no, 1)
        + (extract(year from v_month_start) - extract(year from b.tx_date)) * 12
        + (extract(month from v_month_start) - extract(month from b.tx_date))
      )::int
      || '/' || b.installment_total
    )::text,
    v_month_start <> date_trunc('month', b.tx_date)::date
  FROM base b
  WHERE b.recurrence = 'installment'
    AND b.installment_total IS NOT NULL
    AND v_month_start >= date_trunc('month', b.tx_date)::date
    AND v_month_start < date_trunc('month', b.tx_date)::date
        + ((b.installment_total - coalesce(b.installment_no, 1) + 1) || ' months')::interval;
END;
$$;

GRANT EXECUTE ON FUNCTION public.family_transactions_for_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_transactions_for_month(uuid, date) TO service_role;
