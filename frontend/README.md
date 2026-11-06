# Bus Management System frontend

Standalone Angular/Material starter with overview, preferences, runtime English/German/Arabic switching and Arabic RTL.

Use Node 24 (see .nvmrc) and npm 11. From this directory:

```bash
npm ci
npm start
```

Open http://localhost:4200. No backend/database is required by the current pages.

```bash
npm run format:check
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs unit tests in watch mode. Browser tests start the dev server if needed and cover desktop and mobile Chromium. Production assets are in `dist/bus-management-system/browser/`; their server must support SPA route fallback. Application Dockerfiles and frontend CI follow as separate tasks.

See [frontend setup/design](../docs/frontend-starter.md) and [localization decision](../docs/decisions/0002-frontend-localization.md) for architecture, verified versions, dependency override rationale and current limitations.
