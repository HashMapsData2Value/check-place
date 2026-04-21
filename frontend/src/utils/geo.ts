export function haversineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMiles = 3958.8
  const toRadians = (value: number) => (value * Math.PI) / 180
  const deltaLat = toRadians(latitudeB - latitudeA)
  const deltaLng = toRadians(longitudeB - longitudeA)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
    Math.cos(toRadians(latitudeB)) *
    Math.sin(deltaLng / 2) ** 2

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatMiles(distanceMiles: number) {
  if (!Number.isFinite(distanceMiles) || distanceMiles >= 900) return 'n/a'
  return `${distanceMiles.toFixed(distanceMiles < 10 ? 1 : 0)} mi`
}
