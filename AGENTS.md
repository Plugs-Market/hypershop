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
- All HyperTV API calls go through `src/lib/hypertvClient.server.ts` and are only invoked from server functions in `src/lib/shop.functions.ts` — the shop key must never reach the browser.
- Orders are created and tracked through the HyperTV API (POST /orders, GET /orders/{id}); the local orders table is legacy and unused. Never call POST /activate for customer orders — HyperTV credits the reseller wallet and activates the subscription automatically once payment is confirmed.
- Displayed and charged prices always come from the HyperTV API (price_eur); never compute or send prices from the browser. The checkout idempotency key is generated once per attempt in the form state so a double click cannot create two orders.
- No accounts, login or admin pages in the shop: catalog, prices and customers are managed in the HyperTV reseller panel and read only through its API.
- Normalize subscription offers in src/lib/shop-offers.ts for both catalog and checkout so visibility and purchasability cannot diverge; reseller credit packs are never subscription products.
