import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const [totalTeachers, totalExams, totalSubmissions, activeExams] =
      await Promise.all([
        User.countDocuments({ role: 'teacher' }),
        Exam.countDocuments(),
        Submission.countDocuments(),
        Exam.countDocuments({
          isActive: true,
          startTime: { $lte: new Date() },
          endTime: { $gte: new Date() },
        }),
      ]);

    return NextResponse.json({
      stats: {
        totalTeachers,
        totalExams,
        totalSubmissions,
        activeExams,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}