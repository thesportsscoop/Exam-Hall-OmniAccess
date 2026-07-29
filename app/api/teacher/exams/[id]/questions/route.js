import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

// GET: Get all questions for an exam
export async function GET(request, { params }) {
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

    const questions = await Question.find({ examId: params.id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      questions: questions.map((q) => ({
        ...q,
        _id: q._id.toString(),
        examId: q.examId.toString(),
      })),
    });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add a question to an exam
export async function POST(request, { params }) {
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
    const { type, questionText, options, correctAnswer, markingScheme, points } = body;

    if (!type || !['mcq', 'essay'].includes(type)) {
      return NextResponse.json(
        { error: 'Question type must be "mcq" or "essay"' },
        { status: 400 }
      );
    }

    if (!questionText || questionText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      );
    }

    // Validate MCQ questions have options and correct answer
    if (type === 'mcq') {
      if (!options || options.length < 2) {
        return NextResponse.json(
        { error: 'MCQ questions must have at least 2 options' },
          { status: 400 }
        );
      }
      if (!correctAnswer) {
        return NextResponse.json(
          { error: 'MCQ questions must have a correct answer' },
          { status: 400 }
        );
      }
    }

    // Validate essay questions have marking scheme
    if (type === 'essay' && !markingScheme) {
      return NextResponse.json(
        { error: 'Essay questions must have a marking scheme/rubric' },
        { status: 400 }
      );
    }

    const question = await Question.create({
      examId: params.id,
      type,
      questionText: questionText.trim(),
      options: options || [],
      correctAnswer: correctAnswer || '',
      markingScheme: markingScheme || '',
      points: points || 1,
    });

    return NextResponse.json(
      {
        question: {
          _id: question._id.toString(),
          examId: question.examId.toString(),
          type: question.type,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          markingScheme: question.markingScheme,
          points: question.points,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update a question
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
    const { questionId, questionText, options, correctAnswer, markingScheme, points } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    const question = await Question.findOne({ _id: questionId, examId: params.id });
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (questionText) question.questionText = questionText.trim();
    if (options) question.options = options;
    if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
    if (markingScheme !== undefined) question.markingScheme = markingScheme;
    if (points) question.points = points;

    await question.save();

    return NextResponse.json({
      question: {
        _id: question._id.toString(),
        examId: question.examId.toString(),
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        markingScheme: question.markingScheme,
        points: question.points,
      },
    });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a question
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

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    const question = await Question.findOne({ _id: questionId, examId: params.id });
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await Question.deleteOne({ _id: questionId });

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}