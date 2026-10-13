-- Keep seller balances ledger-backed and make withdrawal requests atomic.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(5,2);

ALTER TABLE public.orders
  ALTER COLUMN commission_rate_snapshot SET DEFAULT 5.00;

UPDATE public.orders AS o
SET commission_rate_snapshot = s.commission_rate
FROM public.seller_stores AS s
WHERE s.id = o.store_id
  AND o.commission_rate_snapshot IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN commission_rate_snapshot SET NOT NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_commission_rate_snapshot_check
  CHECK (commission_rate_snapshot >= 0 AND commission_rate_snapshot <= 100)
  NOT VALID;
ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_commission_rate_snapshot_check;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_reference text;

ALTER TABLE public.seller_wallet_transactions
  ADD COLUMN IF NOT EXISTS withdrawal_request_id uuid
  REFERENCES public.withdrawal_requests(id);

CREATE UNIQUE INDEX IF NOT EXISTS seller_wallet_withdrawal_request_unique
  ON public.seller_wallet_transactions(withdrawal_request_id)
  WHERE withdrawal_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS seller_wallet_order_entry_unique
  ON public.seller_wallet_transactions(order_id, type)
  WHERE order_id IS NOT NULL AND type IN ('sale', 'refund');

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_payout_reference_unique
  ON public.withdrawal_requests(momo_provider, payout_reference)
  WHERE payout_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.withdrawal_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  from_status text,
  to_status text NOT NULL,
  note text,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawal_events_request_created_idx
  ON public.withdrawal_request_events(withdrawal_request_id, created_at);

ALTER TABLE public.withdrawal_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers manage own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.withdrawal_requests;

CREATE POLICY "Sellers read own withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Admins read withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Sellers read own withdrawal events"
  ON public.withdrawal_request_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.withdrawal_requests AS wr
      WHERE wr.id = withdrawal_request_id AND wr.seller_id = auth.uid()
    )
  );

CREATE POLICY "Admins read withdrawal events"
  ON public.withdrawal_request_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage wallet" ON public.seller_wallet_transactions;

CREATE POLICY "Admins read wallet transactions"
  ON public.seller_wallet_transactions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.snapshot_order_commission_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT s.commission_rate
  INTO NEW.commission_rate_snapshot
  FROM public.seller_stores AS s
  WHERE s.id = NEW.store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seller store not found';
  END IF;

  IF NEW.commission_rate_snapshot < 0 OR NEW.commission_rate_snapshot > 100 THEN
    RAISE EXCEPTION 'seller commission rate is outside the supported range';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_snapshot_commission_rate ON public.orders;
CREATE TRIGGER orders_snapshot_commission_rate
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_commission_rate();

CREATE OR REPLACE FUNCTION public.refresh_seller_wallet_order_credit(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_sale_amount numeric(12,2);
  v_existing_sale_amount numeric(12,2);
BEGIN
  SELECT o.id, o.status, o.subtotal, o.commission_rate_snapshot,
         s.owner_id AS seller_id, g.payment_status
  INTO v_order
  FROM public.orders AS o
  JOIN public.seller_stores AS s ON s.id = o.store_id
  JOIN public.order_groups AS g ON g.id = o.order_group_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_order.seller_id::text, 0));

  IF v_order.status = 'completed' AND v_order.payment_status = 'released' THEN
    v_sale_amount := round(
      v_order.subtotal * (100 - v_order.commission_rate_snapshot) / 100,
      2
    );

    IF v_sale_amount > 0 THEN
      INSERT INTO public.seller_wallet_transactions
        (seller_id, type, amount, description, order_id)
      VALUES (
        v_order.seller_id,
        'sale',
        v_sale_amount,
        'Completed order earnings after the recorded store commission',
        v_order.id
      )
      ON CONFLICT (order_id, type)
        WHERE order_id IS NOT NULL AND type IN ('sale', 'refund')
      DO NOTHING;
    END IF;
  END IF;

  IF v_order.status = 'refunded' OR v_order.payment_status = 'refunded' THEN
    SELECT amount
    INTO v_existing_sale_amount
    FROM public.seller_wallet_transactions
    WHERE order_id = v_order.id AND type = 'sale';

    IF FOUND THEN
      INSERT INTO public.seller_wallet_transactions
        (seller_id, type, amount, description, order_id)
      VALUES (
        v_order.seller_id,
        'refund',
        -v_existing_sale_amount,
        'Reversal of seller earnings for a refunded order',
        v_order.id
      )
      ON CONFLICT (order_id, type)
        WHERE order_id IS NOT NULL AND type IN ('sale', 'refund')
      DO NOTHING;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_seller_order_wallet_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_seller_wallet_order_credit(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_refresh_seller_wallet_credit ON public.orders;
CREATE TRIGGER orders_refresh_seller_wallet_credit
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_seller_order_wallet_credit();

CREATE OR REPLACE FUNCTION public.handle_order_group_wallet_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    FOR v_order_id IN
      SELECT id FROM public.orders WHERE order_group_id = NEW.id
    LOOP
      PERFORM public.refresh_seller_wallet_order_credit(v_order_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_groups_refresh_seller_wallet_credit ON public.order_groups;
CREATE TRIGGER order_groups_refresh_seller_wallet_credit
  AFTER UPDATE OF payment_status ON public.order_groups
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION public.handle_order_group_wallet_credit();

-- Backfill qualifying orders without duplicating existing ledger entries.
DO $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    SELECT id FROM public.orders
    WHERE status IN ('completed', 'refunded')
  LOOP
    PERFORM public.refresh_seller_wallet_order_credit(v_order.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_wallet_summary()
RETURNS TABLE (
  wallet_balance numeric,
  total_earned numeric,
  pending_withdrawals numeric,
  available_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid := auth.uid();
BEGIN
  IF v_seller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.seller_stores WHERE owner_id = v_seller_id
  ) THEN
    RAISE EXCEPTION 'an authenticated seller account is required';
  END IF;

  RETURN QUERY
  WITH ledger AS (
    SELECT
      coalesce(sum(t.amount), 0) AS balance,
      coalesce(sum(t.amount) FILTER (WHERE t.type = 'sale'), 0) AS earned
    FROM public.seller_wallet_transactions AS t
    WHERE t.seller_id = v_seller_id
  ),
  reservations AS (
    SELECT coalesce(sum(wr.amount), 0) AS reserved
    FROM public.withdrawal_requests AS wr
    WHERE wr.seller_id = v_seller_id AND wr.status IN ('pending', 'processing')
  )
  SELECT
    ledger.balance,
    ledger.earned,
    reservations.reserved,
    greatest(ledger.balance - reservations.reserved, 0)
  FROM ledger CROSS JOIN reservations;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_seller_withdrawal(
  p_amount numeric,
  p_momo_provider text,
  p_momo_number text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid := auth.uid();
  v_provider text := lower(trim(p_momo_provider));
  v_number text := regexp_replace(trim(p_momo_number), '[[:space:]()-]', '', 'g');
  v_balance numeric(14,2);
  v_reserved numeric(14,2);
  v_request_id uuid;
BEGIN
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'sign in to request a withdrawal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.seller_stores
    WHERE owner_id = v_seller_id AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'an active seller account is required to request a withdrawal';
  END IF;

  IF p_amount IS NULL OR p_amount < 1000 OR p_amount <> trunc(p_amount) THEN
    RAISE EXCEPTION 'withdrawal amount must be a whole XAF amount of at least 1000';
  END IF;

  IF v_provider NOT IN ('mtn', 'orange') THEN
    RAISE EXCEPTION 'choose MTN MoMo or Orange Money';
  END IF;

  IF v_number !~ '^\+?[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'enter a valid mobile money number with country code if needed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_seller_id::text, 0));

  SELECT coalesce(sum(amount), 0)
  INTO v_balance
  FROM public.seller_wallet_transactions
  WHERE seller_id = v_seller_id;

  SELECT coalesce(sum(amount), 0)
  INTO v_reserved
  FROM public.withdrawal_requests
  WHERE seller_id = v_seller_id AND status IN ('pending', 'processing');

  IF v_balance - v_reserved < p_amount THEN
    RAISE EXCEPTION 'withdrawal amount exceeds your available wallet balance';
  END IF;

  INSERT INTO public.withdrawal_requests
    (seller_id, amount, momo_number, momo_provider, status)
  VALUES
    (v_seller_id, p_amount, v_number, v_provider, 'pending')
  RETURNING id INTO v_request_id;

  INSERT INTO public.withdrawal_request_events
    (withdrawal_request_id, actor_id, from_status, to_status)
  VALUES
    (v_request_id, v_seller_id, NULL, 'pending');

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (
    v_seller_id,
    'Withdrawal request received',
    'Your withdrawal request has been received. The amount is reserved while it is pending or processing. Check your wallet for status updates.'
  );

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_transition_withdrawal(
  p_request_id uuid,
  p_action text,
  p_note text DEFAULT NULL,
  p_payout_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.withdrawal_requests%rowtype;
  v_action text := lower(trim(p_action));
  v_note text := nullif(trim(p_note), '');
  v_reference text := nullif(trim(p_payout_reference), '');
  v_provider_label text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'only authorized staff may process withdrawals';
  END IF;

  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal request not found';
  END IF;

  v_provider_label := CASE v_request.momo_provider
    WHEN 'mtn' THEN 'MTN MoMo'
    WHEN 'orange' THEN 'Orange Money'
    ELSE v_request.momo_provider
  END;

  IF v_action = 'processing' AND v_request.status = 'pending' THEN
    UPDATE public.withdrawal_requests
    SET status = 'processing',
        note = coalesce(v_note, note),
        processed_by = v_actor,
        processed_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.withdrawal_request_events
      (withdrawal_request_id, actor_id, from_status, to_status, note)
    VALUES (p_request_id, v_actor, v_request.status, 'processing', v_note);

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      v_request.seller_id,
      'Withdrawal is being processed',
      'Your withdrawal request is being processed manually. Check your wallet for updates.'
    );
    RETURN;
  END IF;

  IF v_action = 'rejected' AND v_request.status IN ('pending', 'processing') THEN
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'provide a reason when rejecting a withdrawal';
    END IF;

    UPDATE public.withdrawal_requests
    SET status = 'rejected',
        note = v_note,
        processed_by = v_actor,
        processed_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.withdrawal_request_events
      (withdrawal_request_id, actor_id, from_status, to_status, note)
    VALUES (p_request_id, v_actor, v_request.status, 'rejected', v_note);

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      v_request.seller_id,
      'Withdrawal request rejected',
      'Your withdrawal request was rejected: ' || v_note
    );
    RETURN;
  END IF;

  IF v_action = 'paid' AND v_request.status = 'processing' THEN
    IF v_reference IS NULL OR char_length(v_reference) < 3 OR char_length(v_reference) > 120 THEN
      RAISE EXCEPTION 'enter the provider transaction reference before marking paid';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_request.seller_id::text, 0));

    UPDATE public.withdrawal_requests
    SET status = 'paid',
        note = coalesce(v_note, note),
        payout_reference = v_reference,
        processed_by = v_actor,
        processed_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.seller_wallet_transactions
      (seller_id, type, amount, description, withdrawal_request_id)
    VALUES (
      v_request.seller_id,
      'withdrawal',
      -v_request.amount,
      'Manual withdrawal paid to ' || v_provider_label || ' ' || v_request.momo_number ||
        ' (reference ' || v_reference || ')',
      p_request_id
    );

    INSERT INTO public.withdrawal_request_events
      (withdrawal_request_id, actor_id, from_status, to_status, note, payout_reference)
    VALUES (p_request_id, v_actor, v_request.status, 'paid', v_note, v_reference);

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      v_request.seller_id,
      'Withdrawal marked as paid',
      'Your withdrawal of ' || v_request.amount::text || ' XAF was marked as paid to ' ||
        v_provider_label || '. Reference: ' || v_reference || '.'
    );
    RETURN;
  END IF;

  RAISE EXCEPTION 'withdrawal cannot transition from % to %', v_request.status, v_action;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_order_commission_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_seller_wallet_order_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_seller_order_wallet_credit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_group_wallet_credit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_seller_withdrawal(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_transition_withdrawal(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_seller_wallet_summary() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_withdrawal(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_wallet_summary() TO authenticated;
