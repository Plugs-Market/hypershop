DROP POLICY IF EXISTS "products public read" ON public.products;
REVOKE SELECT ON public.products FROM anon;