import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ProctoringSession from '@/models/ProctoringSession';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';

// POST: Create a new proctoring session
export async function POST(request) {
  try {
    const body = await request.json();
    const { examId, submissionId, studentName } = body;

    if (!examId || !submissionId || !studentName) {
      return NextResponse.json(
        { error: 'examId, submissionId, and studentName are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Check if session already exists
    const existing = await ProctoringSession.findOne({ submissionId });
    if (existing) {
      return NextResponse.json({ session: existing });
    }

    const session = await ProctoringSession.create({
      examId,
      submissionId,
      studentName,
      status: 'in_progress',
      startedAt: new Date(),
      events: [
        {
          type: 'session_started',
          severity: 'info',
          details: 'Proctoring session started',
        },
      ],
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Create proctoring session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Get proctoring sessions (with optional filters)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const submissionId = searchParams.get('submissionId');
    const status = searchParams.get('status');

    await dbConnect();

    const filter = {};
    if (examId) filter.examId = examId;
    if (submissionId) filter.submissionId = submissionId;
    if (status) filter.status = status;

    const sessions = await ProctoringSession.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        ...s,
        _id: s._id.toString(),
        examId: s.examId.toString(),
        submissionId: s.submissionId.toString(),
      })),
    });
  } catch (error) {
    console.error('Get proctoring sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}