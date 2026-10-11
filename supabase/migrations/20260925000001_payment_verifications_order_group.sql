-- payment_verifications was tied to a single per-store `orders` row, but one
-- checkout payment covers every store in the cart at once (one order_group
-- fans out into N per-store `orders` rows — see cart_and_orders.sql). Point
-- it at the order_group instead so a multi-seller cart only needs the one
-- payment_verifications row the buyer actually submitted.

ALTER TABLE payment_verifications
  ADD COLUMN IF NOT EXISTS order_group_id uuid REFERENCES order_groups(id) ON DELETE CASCADE;

ALTER TABLE payment_verifications
  ALTER COLUMN order_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS pv_order_group_idx ON payment_verifications(order_group_id);

ALTER TABLE payment_verifications
  ADD CONSTRAINT pv_has_order_or_group
  CHECK (order_id IS NOT NULL OR order_group_id IS NOT NULL);
