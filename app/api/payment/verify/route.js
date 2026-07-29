import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = 'https://api.paystack.co';

// Verify a Paystack transaction reference
async function verifyTransaction(reference) {
  const response = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();

  if (!data.status) {
    throw new Error(data.message || 'Verification failed');
  }

  return data.data;
}

// GET: Verify payment after redirect from Paystack
export async function GET(request) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');
    const examId = searchParams.get('examId');

    if (!reference) {
      return NextResponse.json(
        { error: 'Transaction reference is required' },
        { status: 400 }
      );
    }

    const verification = await verifyTransaction(reference);

    if (verification.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment was not successful', status: verification.status },
        { status: 400 }
      );
    }

    // Update exam payment status if examId is provided
    if (examId) {
      await dbConnect();
      const exam = await Exam.findById(examId);
      if (exam && exam.teacherId.toString() === decoded.id) {
        exam.isPaid = true;
        exam.paymentReference = reference;
        await exam.save();
      }
    }

    return NextResponse.json({
      verified: true,
      status: verification.status,
      amount: verification.amount / 100, // Convert back from pesewas
      reference: verification.reference,
      paidAt: verification.paid_at,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Handle Paystack webhook events
export async function POST(request) {
  try {
    // Verify webhook signature
    const paystackSignature = request.headers.get('x-paystack-signature');
    const body = await request.text();

    if (!paystackSignature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Generate signature using HMAC-SHA256
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (hash !== paystackSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    // Handle charge.success event
    if (event.event === 'charge.success') {
      const { reference, metadata, amount } = event.data;

      await dbConnect();

      // Find the exam by metadata.examId if it exists
      if (metadata?.examId) {
        const exam = await Exam.findById(metadata.examId);
        if (exam) {
          exam.isPaid = true;
          exam.paymentReference = reference;
          await exam.save();
          console.log(`Exam ${exam._id} marked as paid via webhook`);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to prevent Paystack from retrying
    return NextResponse.json({ received: true });
  }
}