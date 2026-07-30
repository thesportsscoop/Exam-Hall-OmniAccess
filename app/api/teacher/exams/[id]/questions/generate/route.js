import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';
import { generateQuestions } from '@/lib/ai-generator';

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
    const { prompt, format } = body;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide a topic or prompt for question generation' },
        { status: 400 }
      );
    }

    if (prompt.length < 5) {
      return NextResponse.json(
        { error: 'Please provide a more detailed topic description (at least 5 characters)' },
        { status: 400 }
      );
    }

    // Generate questions using AI with fallback chain
    const finalFormat = format || exam.format || 'hybrid';
    const generatedQuestions = await generateQuestions(prompt, finalFormat);

    if (!generatedQuestions || generatedQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Could not generate questions from the provided prompt. Please try a more specific topic.' },
        { status: 400 }
      );
    }

    // Save generated questions to database
    const createdQuestions = [];
    for (const q of generatedQuestions) {
      const question = await Question.create({
        examId: params.id,
        type: q.type,
        questionText: q.questionText,
        options: q.type === 'mcq' ? q.options : [],
        correctAnswer: q.type === 'mcq' ? q.correctAnswer : '',
        markingScheme: q.type === 'essay' ? q.markingScheme : '',
        points: q.points,
      });

      createdQuestions.push({
        _id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        markingScheme: question.markingScheme,
        points: question.points,
      });
    }

    const mcqCount = generatedQuestions.filter(q => q.type === 'mcq').length;
    const essayCount = generatedQuestions.filter(q => q.type === 'essay').length;
    let summary = `Successfully generated ${createdQuestions.length} questions`;
    if (mcqCount > 0) summary += ` (${mcqCount} MCQ`;
    if (essayCount > 0) summary += `${mcqCount > 0 ? ', ' : ' ('}${essayCount} Essay`;
    if (mcqCount > 0 || essayCount > 0) summary += ')';

    return NextResponse.json({
      message: summary,
      questions: createdQuestions,
      generateInfo: {
        totalGenerated: createdQuestions.length,
        mcqCount,
        essayCount,
        prompt: prompt.substring(0, 100),
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}