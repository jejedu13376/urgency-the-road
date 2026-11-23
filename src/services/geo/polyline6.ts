/**
 * Decode Valhalla/OSRM-style encoded polyline with precision 1e6 (polyline6).
 * Returns [lat, lon] pairs.
 */
export function decodePolyline6(encoded: string): Array<[number, number]> {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lon = 0;
  const coordinates: Array<[number, number]> = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;

    coordinates.push([lat / 1e6, lon / 1e6]);
  }

  return coordinates;
}
