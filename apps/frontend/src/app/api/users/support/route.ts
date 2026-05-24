import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseUrl = process.env.NEXT_PUBLIC_USER_SERVICE_URL || process.env.USER_SERVICE_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/v1/users/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Unable to send support message' },
      { status: 502 },
    );
  }
}
