import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ProctoringSession from '@/models/ProctoringSession';

// GET: Get a specific proctoring session
export async function GET(request, { params }) {
  try {
    await dbConnect();
    const session = await ProctoringSession.findById(params.id).lean();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        ...session,
        _id: session._id.toString(),
        examId: session.examId.toString(),
        submissionId: session.submissionId.toString(),
      },
    });
  } catch (error) {
    console.error('Get proctoring session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update session fields (identity, scan, events, status, etc.)
export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    await dbConnect();

    const session = await ProctoringSession.findById(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update identity verification
    if (body.identityVerification) {
      session.identityVerification = {
        ...session.identityVerification,
        ...body.identityVerification,
        verifiedAt: body.identityVerification.verified ? new Date() : session.identityVerification.verifiedAt,
      };
    }

    // Update environment scan
    if (body.environmentScan) {
      session.environmentScan = {
        ...session.environmentScan,
        ...body.environmentScan,
      };
    }

    // Add new event
    if (body.event) {
      session.events.push(body.event);
    }

    // Update status
    if (body.status) {
      session.status = body.status;
      if (body.status === 'completed' || body.status === 'rejected') {
        session.endedAt = new Date();
      }
    }

    // Update violation/warning counts
    if (body.violationCount !== undefined) session.violationCount = body.violationCount;
    if (body.warningCount !== undefined) session.warningCount = body.warningCount;
    if (body.recordingUrl !== undefined) session.recordingUrl = body.recordingUrl;

    await session.save();

    return NextResponse.json({
      session: {
        ...session.toObject(),
        _id: session._id.toString(),
        examId: session.examId.toString(),
        submissionId: session.submissionId.toString(),
      },
    });
  } catch (error) {
    console.error('Update proctoring session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Clean up a session
export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const session = await ProctoringSession.findByIdAndDelete(params.id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete proctoring session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}