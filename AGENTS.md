<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All HyperTV API calls go through `src/lib/hypertvClient.server.ts` and are invoked only by feature server functions — the shop key must never reach the browser.
- Orders are created and tracked through the HyperTV API (POST /orders, GET /orders/{id}); the local orders table is legacy and unused. Never call POST /activate for customer orders — HyperTV credits the reseller wallet and activates the subscription automatically once payment is confirmed.
- Displayed and charged prices always come from the HyperTV API (price_eur); never compute or send prices from the browser. The checkout idempotency key is generated once per attempt in the form state so a double click cannot create two orders.
- No local accounts or admin pages: catalog, prices and customers live in the HyperTV reseller panel. The customer area (/connexion, /mon-compte) only proxies HyperTV /account endpoints via server functions, storing the HyperTV session in an HttpOnly cookie and never the access key.
- Normalize HyperTV and TREX offers in src/lib/shop-offers.ts for both catalog and checkout so visibility and purchasability cannot diverge; reseller credit packs are never subscription products.
- TREX reuses the existing checkout route with a product-type search parameter; src/lib/shop-order.ts validates exactly one product identifier, preserves retry keys for unchanged attempts, and centralizes activation progress and polling rules to prevent divergent checkout/tracking behavior.
- Bind checkout attempts to a random HttpOnly owner cookie via server-only hash records before calling HyperTV; only the proven owner may read delivery or download, including free orders. Legacy UUID-only tracking must never grant delivery access.
- Keep delivery out of route loaders and SSR hydration; fetch it on demand into ephemeral component state with no-store responses, and download only the API-provided URL through the protected server endpoint with exact supplier allowlisting, public DNS checks, bounded redirects, time and size limits.
- Customer invoice reads and mutations use the HttpOnly HyperTV customer session as API authorization; verify invoice ownership by reading through /account/invoices before order payment actions, never by accepting a browser-supplied order ID. This keeps account access separate from anonymous checkout proofs.
- Use un-nested mon-compte_ invoice routes so account content is not rendered instead of invoice pages; keep invoice filters in URL search and credentials out of Query and SSR caches.
- Support chiffré : tout le chiffrement (ECDH/AES-GCM, clés IndexedDB) reste dans le navigateur (src/lib/support-crypto.ts) ; le serveur de la boutique ne relaie que des données chiffrées et le flux SSE via /api/support-stream, pour que ni la boutique ni HyperTV ne lisent les messages.
