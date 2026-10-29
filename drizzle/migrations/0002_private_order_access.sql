CREATE TABLE public.shop_order_access (
 attempt_id uuid PRIMARY KEY,
 owner_hash text NOT NULL,
 request_hash text NOT NULL,
 order_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shop_order_access TO service_role;
REVOKE ALL ON public.shop_order_access FROM anon, authenticated;
ALTER TABLE public.shop_order_access ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.shop_order_access IS 'Server-only ownership proofs for HyperTV orders; no IPTV credentials stored. No browser policies by design.';