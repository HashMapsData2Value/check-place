# check-place

Static React frontend for checking how practical an address looks from a real-estate perspective.

The app does three things:

1. Takes a user-entered address.
2. Calls the Google Geocoding API to convert that address into latitude and longitude.
3. Compares the coordinates against a starter landmark dataset and groups the nearest matches into useful categories.

Current categories:

- University of Maryland shuttle landmarks
- Public transportation in the DMV
- Hospitals
- Big supermarkets and warehouse grocery options

## Local setup

Create a local environment file and add a browser-restricted Google Maps API key:

```bash
cp .env.example .env.local
```

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Enable the Google Geocoding API for that key, then restrict the key by HTTP referrer before using it in production.

Install and run:

```bash
npm install
npm run dev
```

## Notes

- The landmark list is intentionally small and curated so it is easy to expand.
- The current seed data is centered on College Park and the broader DMV.
- To support other schools or regions, extend the landmark array in src/App.tsx.
