# backend

Minimal Fastify service for `check-place`.

Quick start:

1. Install deps

```bash
cd backend
npm install
```

2. Run in development

```bash
npm run dev
```

3. Build and run production

```bash
npm run build
npm start
```

Environment:
- `GOOGLE_API_KEY` required for Google Maps geocoding calls.
- `PORT` optional (defaults to 3001)
