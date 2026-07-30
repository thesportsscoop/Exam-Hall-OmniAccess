import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const EXAM_CREATION_FEE = 100; // GHS 100
const PAYSTACK_API = 'https://api.paystack.co';

export async function POST(request) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Paystack is not configured' },
        { status: 500 }
      );
    }

    const { email, metadata } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use the host from the request to build the callback URL dynamically
    // This ensures it works in both local development and production
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: EXAM_CREATION_FEE * 100, // Paystack expects amount in pesewas (GHS * 100)
        currency: 'GHS',
        metadata: {
          ...metadata,
          teacherId: decoded.id,
          purpose: 'exam_creation',
        },
        callback_url: `${baseUrl}/dashboard/exams/create?payment_status=completed`,
      }),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack initialization failed:', data);
      return NextResponse.json(
        { error: 'Payment initialization failed. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}