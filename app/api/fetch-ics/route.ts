import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing calendar URL.' }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Next.js iCal proxy',
        Accept: 'text/calendar, application/ical, application/octet-stream, */*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Remote calendar fetch failed with ${response.status} ${response.statusText}.` },
        { status: 502 },
      );
    }

    const text = await response.text();
    return NextResponse.json({ data: text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to fetch calendar URL.' },
      { status: 500 },
    );
  }
}
