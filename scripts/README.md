# Scripts Overview

This folder is split into:

- `scripts/ops/`: supported operational scripts.
- `scripts/ralph/`: Ralph workflow automation (managed separately).

## Supported Ops Scripts

- `scripts/ops/reconcile-payments.ts`
  - Purpose: reconcile payment/booking consistency.
  - Script: `npm run payments:reconcile`
- `scripts/ops/check-database.js`
  - Purpose: DB connectivity and model counts.
  - Script: `npm run check-database`
- `scripts/ops/check-bookings.js`
  - Purpose: inspect recent bookings and booking requests.
  - Script: `npm run check-bookings`
- `scripts/ops/check-availabilities.js`
  - Purpose: inspect room availability record counts.
  - Script: `npm run check-availabilities`
- `scripts/ops/update-prices.js`
  - Purpose: update canonical room-type prices.
  - Script: `npm run update-prices`
  - Defaults to dry-run; pass `--confirm` to apply.
- `scripts/ops/clear-database.js` (dangerous)
  - Purpose: clear database tables in non-production environments.
  - Script: `npm run clear-db`
  - Requires:
    - `ALLOW_DB_DESTRUCTIVE=true`
    - `TARGET_ENV=development|staging|test`
    - interactive confirmation and typed phrase.
