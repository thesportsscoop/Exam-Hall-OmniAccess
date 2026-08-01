import { NextResponse } from 'next/server';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import dbConnect from '@/lib/mongodb';

export async function POST(request) {
  try {
    await dbConnect();
    const { surname, firstName, className, passkey } = await request.json();

    if (!surname || !firstName || !passkey) {
      return NextResponse.json({ error: 'Surname, first name, and passkey are required' }, { status: 400 });
    }

    const exam = await Exam.findOne({ passkey: passkey.toUpperCase() });
    if (!exam) {
      return NextResponse.json({ error: 'Invalid passkey' }, { status: 404 });
    }

    if (!exam.isActive) {
      return NextResponse.json({ error: 'This exam is not currently active' }, { status: 403 });
    }

    if (!exam.isPaid) {
      return NextResponse.json({ error: 'Exam payment not completed' }, { status: 403 });
    }

    const now = new Date();
    if (now < exam.startTime) {
      return NextResponse.json({ error: 'Exam has not started yet' }, { status: 403 });
    }
    if (now > exam.endTime) {
      return NextResponse.json({ error: 'Exam has ended' }, { status: 403 });
    }

    // Validate class if classes are specified
    if (exam.classes.length > 0) {
      if (!className) {
        return NextResponse.json({ error: 'Please select your class' }, { status: 400 });
      }
      if (!exam.classes.includes(className)) {
        return NextResponse.json({ error: 'Your class is not eligible for this exam' }, { status: 403 });
      }
    }

    const questions = await Question.find({ examId: exam._id }).sort({ createdAt: 1 });

    return NextResponse.json({
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        format: exam.format,
        durationMinutes: exam.durationMinutes,
        showResults: exam.showResults,
        classes: exam.classes,
      },
      student: { surname, firstName, className },
      questions: questions.map(q => ({
        id: q._id,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        points: q.points,
      })),
    });
  } catch (error) {
    console.error('Error joining exam:', error);
    return NextResponse.json({ error: 'Failed to join exam' }, { status: 500 });
  }
}