# Perez Automotive Website + Staff Portal

A luxury black, gold, and silver dealership website for Perez Automotive, built for GTA/Eclipse RP manual business records.

## What is included

- Public website pages: Home, About, Services, Inventory, Careers/Application, Contact, Staff Login
- Private staff dashboard / management portal
- Vehicle inventory records
- Vehicle purchase request approvals
- Vehicle sale records
- Customer records
- Job applications with statuses
- Staff roster and performance cards
- Treasury ledger
- Staff payout records
- Live commission calculator
- Activity logs
- Role-based mock permissions
- Perez Automotive logo included in `assets/perez-logo.png`

## Important

This first version uses browser `localStorage`, so it saves records on the device/browser that is using it. It does not use real payment processing and does not connect to a real database yet. This is perfect for a fast first version and demo, but for multiple staff members using the same live records, connect it later to Cloudflare D1, Supabase, Firebase, or another database.

## Demo staff logins

- Owner: `owner@perezauto.rp` / `owner123`
- Co-Owner: `coowner@perezauto.rp` / `coowner123`
- General Manager: `manager@perezauto.rp` / `manager123`
- Sourcer: `sourcer@perezauto.rp` / `sourcer123`
- Sales: `sales@perezauto.rp` / `sales123`
- Clerk: `clerk@perezauto.rp` / `clerk123`

## GitHub + Cloudflare Pages deployment

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. In Cloudflare, go to Pages and connect the GitHub repository.
4. Framework preset: None / Static HTML.
5. Build command: leave blank.
6. Output directory: `/` or leave as default/root.
7. Deploy.

## File structure

```text
perez-automotive-website/
├── index.html
├── styles.css
├── app.js
├── README.md
└── assets/
    └── perez-logo.png
```

## Notes for upgrading later

To make records shared across every staff member, replace the localStorage helpers in `app.js` with database calls. Recommended next step for Cloudflare is Cloudflare D1 with a Pages Function API.

## Cloudflare D1 shared database setup

This D1-ready version includes:

- `functions/api/db.js` — Cloudflare Pages Function at `/api/db`
- `schema.sql` — the D1 table you must create once
- Updated `app.js` — syncs dashboard data to D1 when deployed on Cloudflare Pages

### Cloudflare settings

1. Create a D1 database named `perez-automotive-db`.
2. Open your Pages project: `perez-automotive-website`.
3. Go to Settings → Bindings.
4. Add a D1 database binding.
5. Variable name must be exactly: `DB`.
6. Select your `perez-automotive-db` database.
7. Redeploy the Pages project.

### Run schema.sql

Open the D1 database console and run the contents of `schema.sql` once.

### Important security note

This version is built for GTA/Eclipse RP record keeping and easy setup. For a real secure private dashboard, protect the site with Cloudflare Access or add server-side authentication before using sensitive records.
