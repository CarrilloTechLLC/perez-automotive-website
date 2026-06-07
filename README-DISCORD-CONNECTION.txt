Perez Automotive - Discord Connection Setup

This version adds:
1. Website -> Discord alerts using Cloudflare Pages Functions.
2. Optional website -> Discord invite button using DISCORD_INVITE_URL in app.js.
3. D1 API function included at functions/api/db.js.
4. Discord alert function included at functions/api/discord-alert.js.

Cloudflare environment variables to add:
DISCORD_APPLICATION_WEBHOOK
DISCORD_GENERAL_WEBHOOK
DISCORD_PURCHASE_WEBHOOK
DISCORD_SALES_WEBHOOK
DISCORD_TREASURY_WEBHOOK
DISCORD_PAYOUT_WEBHOOK
DISCORD_WEBSITE_ADMIN_WEBHOOK
DISCORD_SYSTEM_WEBHOOK

Optional:
DISCORD_INVENTORY_WEBHOOK
DISCORD_CUSTOMER_WEBHOOK
DISCORD_VEHICLE_REQUEST_WEBHOOK
DISCORD_SERVICE_WEBHOOK

Recommended channel mapping:
DISCORD_APPLICATION_WEBHOOK -> #application-logs
DISCORD_GENERAL_WEBHOOK -> #general-inquiries
DISCORD_PURCHASE_WEBHOOK -> #purchase-requests
DISCORD_SALES_WEBHOOK -> #sales-records
DISCORD_TREASURY_WEBHOOK -> #treasury-ledger
DISCORD_PAYOUT_WEBHOOK -> #payout-approvals
DISCORD_WEBSITE_ADMIN_WEBHOOK -> #website-admin
DISCORD_SYSTEM_WEBHOOK -> #website-alerts
DISCORD_INVENTORY_WEBHOOK -> #inventory-records
DISCORD_CUSTOMER_WEBHOOK -> #customer-records

To add a public Discord invite button on the website:
Open app.js and replace PASTE_YOUR_DISCORD_INVITE_HERE with your permanent Perez Automotive Discord invite link.
