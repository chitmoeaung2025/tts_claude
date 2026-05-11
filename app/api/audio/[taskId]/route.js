import { NextResponse } from 'next/server';

const BASE = 'https://api.ai84.pro';

export async function GET(request, { params }) {
  const { taskId } = params;
  const rawUrl     = request.url || '';
  const qIdx       = rawUrl.indexOf('?');
  const search     = qIdx !== -1 ? rawUrl.slice(qIdx) : '';
  const sp         = new URLSearchParams(search.slice(1));
  const apiKey     = sp.get('key') || '';

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 400 });
  }

  try {
    // First get the signed audio URL from the task endpoint
    const taskRes  = await fetch(`${BASE}/v1/task/${taskId}`, {
      headers: { 'xi-api-key': apiKey },
    });
    const taskData = await taskRes.json();
    const audioUrl = taskData?.metadata?.audio_url;

    if (!audioUrl) {
      // Fallback: try the audio proxy endpoint directly
      const audioRes = await fetch(`${BASE}/v1/task/${taskId}/audio`, {
        headers: { 'xi-api-key': apiKey },
      });
      if (!audioRes.ok) {
        return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
      }
      const buffer      = await audioRes.arrayBuffer();
      const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
      return new Response(buffer, {
        headers: {
          'Content-Type':  contentType,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Fetch the signed CDN URL server-side (no CORS issue)
    const cdnRes = await fetch(audioUrl);
    if (!cdnRes.ok) {
      return NextResponse.json({ error: 'CDN fetch failed' }, { status: 502 });
    }
    const buffer      = await cdnRes.arrayBuffer();
    const contentType = cdnRes.headers.get('content-type') || 'audio/mpeg';

    return new Response(buffer, {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
