import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const decoded = await getAuthUser(request);
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

export async function POST(request) {
  try {
    const decoded = await getAuthUser(request);
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { title, description, durationMinutes, startTime, endTime, passkey, format, teacherId } = await request.json();

    if (!title || !durationMinutes || !startTime || !endTime || !passkey) {
      return NextResponse.json(
        { error: 'Title, duration, start time, end time, and passkey are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if passkey already exists
    const existingExam = await Exam.findOne({ passkey: passkey.toUpperCase() });
    if (existingExam) {
      return NextResponse.json(
        { error: 'Passkey already exists' },
        { status: 400 }
      );
    }

    const exam = await Exam.create({
      title,
      description: description || '',
      durationMinutes,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      passkey: passkey.toUpperCase(),
      format: format || 'mcq',
      teacherId: teacherId || decoded.id,
      isPaid: true,
      isActive: true,
    });

    return NextResponse.json({
      message: 'Exam created successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
        passkey: exam.passkey,
        format: exam.format,
        teacherId: exam.teacherId,
      },
    });
  } catch (error) {
    console.error('Create exam error:', error);
    return NextResponse.json(
      { error: 'Failed to create exam' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const decoded = await getAuthUser(request);
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('id');

    if (!examId) {
      return NextResponse.json(
        { error: 'Exam ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Delete exam and related data
    await Exam.findByIdAndDelete(examId);
    await Submission.deleteMany({ examId });
    // Note: Questions will be deleted via mongoose middleware if set up, or manually:
    // await Question.deleteMany({ examId });

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam' },
      { status: 500 }
    );
  }
}
