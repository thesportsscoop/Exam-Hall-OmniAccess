import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import ProctoringSession from '@/models/ProctoringSession';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

// GET: Get all proctoring sessions for an exam (teacher access)
export async function GET(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    // Verify the exam belongs to this teacher
    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const sessions = await ProctoringSession.find({ examId: params.id })
      .sort({ createdAt: -1 })
      .lean();

    const sessionsWithDetails = sessions.map((s) => ({
      _id: s._id.toString(),
      examId: s.examId.toString(),
      submissionId: s.submissionId.toString(),
      studentName: s.studentName,
      status: s.status,
      violationCount: s.violationCount,
      warningCount: s.warningCount,
      events: s.events,
      identityVerification: s.identityVerification,
      environmentScan: s.environmentScan,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({
      examTitle: exam.title,
      sessions: sessionsWithDetails,
      totalSessions: sessions.length,
      flaggedSessions: sessions.filter((s) => s.status === 'flagged').length,
      completedSessions: sessions.filter((s) => s.status === 'completed').length,
    });
  } catch (error) {
    console.error('Get proctoring reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}