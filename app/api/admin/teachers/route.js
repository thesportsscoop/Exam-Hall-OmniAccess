import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const teachers = await User.find({ role: 'teacher' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Get exam count for each teacher
    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const examCount = await Exam.countDocuments({
          teacherId: teacher._id,
        });
        return {
          ...teacher,
          _id: teacher._id.toString(),
          examCount,
        };
      })
    );

    return NextResponse.json({ teachers: teachersWithStats });
  } catch (error) {
    console.error('Admin teachers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}