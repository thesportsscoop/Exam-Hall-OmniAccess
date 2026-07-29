import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exams = await Exam.find({})
      .populate('teacherId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Get submission count for each exam
    const examsWithStats = await Promise.all(
      exams.map(async (exam) => {
        const submissionCount = await Submission.countDocuments({
          examId: exam._id,
        });
        return {
          ...exam,
          _id: exam._id.toString(),
          teacherId: exam.teacherId
            ? {
                _id: exam.teacherId._id.toString(),
                name: exam.teacherId.name,
                email: exam.teacherId.email,
              }
            : null,
          submissionCount,
        };
      })
    );

    return NextResponse.json({ exams: examsWithStats });
  } catch (error) {
    console.error('Admin exams error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}