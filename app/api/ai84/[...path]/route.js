import { NextResponse } from 'next/server';

const BASE = 'https://api.ai84.pro';

async function handler(request, { params }) {
  const pathArr = params.path || [];
  const path = pathArr.join('/');

  const rawUrl = request.url || '';
  const qIdx = rawUrl.indexOf('?');
  const search = qIdx !== -1 ? rawUrl.slice(qIdx) : '';
  const targetUrl = `${BASE}/${path}${search}`;

  const headers = {};
  const apiKey = request.headers.get('x-api-key');
  const authToken = request.headers.get('x-auth-token');
  const contentType = request.headers.get('content-type');

  if (apiKey) headers['xi-api-key'] = apiKey;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (contentType) headers['Content-Type'] = contentType;

  const options = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) options.body = body;
  }

  try {
    const res = await fetch(targetUrl, options);
    const resContentType = res.headers.get('content-type') || '';

    // Binary response (audio) — stream back directly
    if (!resContentType.includes('application/json')) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        status: res.status,
        headers: { 'Content-Type': resContentType || 'audio/mpeg' },
      });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: 'Proxy error', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req, ctx) { return handler(req, ctx); }
export async function POST(req, ctx) { return handler(req, ctx); }
