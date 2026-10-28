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
- Orders have no client RLS policies; they are read/written only server-side, and activation always reuses the order id as idempotency key so a retry never charges twice.
- No accounts, login or admin pages in the shop: catalog, prices and customers are managed in the HyperTV reseller panel and read only through its API.
