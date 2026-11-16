# Connecting the domain

Status: **not verified from the repo or this tooling.** The roadmap lists "Domain purchase and configuration" as not confirmed, and the tools used for development can see the Worker (`govibearcadia`) but not the account's domains, DNS or routes. Check each step below in the Cloudflare dashboard before relying on it.

## What the code already assumes

- `src/site.ts` sets `SITE_URL = 'https://govibearcade.com'`. Canonical links, `og:` tags, `robots.txt` and `sitemap.xml` are generated from it at build time (`src/lib/seo.ts`, `vite.config.ts`).
- No other file hard-codes a host, and the Worker (`worker/`) has no Origin, Host or CORS checks, so the app works the same on `*.workers.dev` and on a custom domain. Online rooms use same-origin WebSockets.
- If the final domain is not `govibearcade.com`, change `SITE_URL` in one place and redeploy.

## Steps (owner, Cloudflare dashboard)

1. **Domain on Cloudflare.** The domain must be an active zone in the same Cloudflare account as the Worker (add the site, or move its nameservers to Cloudflare, then wait for "Active").
2. **Attach it to the Worker.** Workers & Pages, `govibearcadia`, Settings, Domains & Routes, Add, Custom domain. Enter `govibearcade.com`. Cloudflare creates the DNS record and certificate itself. Repeat for `www.govibearcade.com`.
3. **Pick one canonical host.** Because canonical tags point at the bare domain, redirect `www` to it (Rules, Redirect Rules, a single dynamic redirect from `www.govibearcade.com/*` to `https://govibearcade.com/${1}`, status 301).
4. **Check HTTPS.** SSL/TLS mode Full (strict); turn on "Always use HTTPS".
5. **Check the app on the new host** (from a normal browser):
   - the home page, a game page and a hard refresh on `/play/<id>` (single-page fallback)
   - the app installs and works offline after one visit (service worker is per-origin, so it re-installs on the new host)
   - `/robots.txt` and `/sitemap.xml` list `https://govibearcade.com/...`
   - an online room (Nine Men's Morris) connects between two devices
6. **Do not commit a route to `wrangler.jsonc` unless you want it applied on the next push.** The live branch deploys automatically through Workers Builds, so a `routes` entry there changes production as soon as it is pushed. Attaching in the dashboard (step 2) avoids that.

## Things that reset on a new origin

IndexedDB (history, favourites, passport) and the sound setting are stored per origin. Players moving from `*.workers.dev` to the custom domain start with empty local data; the Backup page can export and import it.

## Not covered here

Email for the domain, analytics (none by design), and buying the domain.
