import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

// GET: Get a single exam with its questions
export async function GET(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id }).lean();
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const questions = await Question.find({ examId: params.id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      exam: {
        ...exam,
        _id: exam._id.toString(),
      },
      questions: questions.map((q) => ({
        ...q,
        _id: q._id.toString(),
        examId: q.examId.toString(),
      })),
    });
  } catch (error) {
    console.error('Get exam error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update exam details
export async function PUT(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, durationMinutes, startTime, endTime, passkey, format, classes, isActive } = body;

    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (durationMinutes) exam.durationMinutes = durationMinutes;
    if (startTime) exam.startTime = new Date(startTime);
    if (endTime) exam.endTime = new Date(endTime);
    if (passkey) {
      if (passkey.length < 4) {
        return NextResponse.json(
          { error: 'Passkey must be at least 4 characters' },
          { status: 400 }
        );
      }
      exam.passkey = passkey;
    }
    if (format) exam.format = format;
    if (classes) exam.classes = classes;
    if (isActive !== undefined) exam.isActive = isActive;

    await exam.save();

    return NextResponse.json({
      exam: {
        _id: exam._id.toString(),
        title: exam.title,
        format: exam.format,
        isPaid: exam.isPaid,
        isActive: exam.isActive,
      },
    });
  } catch (error) {
    console.error('Update exam error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete an exam and its questions
export async function DELETE(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Delete all questions for this exam
    await Question.deleteMany({ examId: params.id });

    // Delete the exam
    await Exam.deleteOne({ _id: params.id });

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}