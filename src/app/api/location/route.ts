import { headers } from 'next/headers';

const DEFAULT_LOCATION = {
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
};

export const runtime = 'nodejs';

export async function GET() {
  try {
    const requestHeaders = await headers();
    const vercelCity = requestHeaders.get('x-vercel-ip-city');
    const vercelLatitude = requestHeaders.get('x-vercel-ip-latitude');
    const vercelLongitude = requestHeaders.get('x-vercel-ip-longitude');

    if (vercelLatitude && vercelLongitude) {
      return Response.json({
        latitude: Number(vercelLatitude),
        longitude: Number(vercelLongitude),
        city: vercelCity || DEFAULT_LOCATION.city,
      });
    }

    const ipapiResponse = await fetch('https://ipapi.co/json/', {
      headers: {
        'User-Agent': 'AriApp/1.0',
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!ipapiResponse.ok) {
      return Response.json(DEFAULT_LOCATION);
    }

    const ipapiData = await ipapiResponse.json();
    return Response.json({
      latitude: Number(ipapiData.latitude) || DEFAULT_LOCATION.latitude,
      longitude: Number(ipapiData.longitude) || DEFAULT_LOCATION.longitude,
      city: ipapiData.city || DEFAULT_LOCATION.city,
    });
  } catch (error) {
    console.error('Failed to resolve approximate location:', error);
    return Response.json(DEFAULT_LOCATION);
  }
}
