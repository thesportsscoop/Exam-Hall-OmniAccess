import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';
import { parseQuestions } from '@/lib/question-parser/index.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/exams/[id]/questions/parse
 * Multi-stage pipeline:
 * 1. Normalize text
 * 2. Detect sections
 * 3. Parse with dedicated parsers (MCQ, Essay)
 * 4. AI Validation
 * Supports preview mode or direct database saving when saveToDb is true.
 */
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
    const { text, saveToDb } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Run the multi-stage parsing pipeline[cite: 11]
    const parseResult = await parseQuestions(text);

    let savedCount = 0;
    const createdQuestions = [];

    // If persistence is requested, save parsed questions to MongoDB
    if (saveToDb && parseResult.questions && parseResult.questions.length > 0) {
      for (const q of parseResult.questions) {
        const newQuestion = await Question.create({
          examId: params.id,
          type: q.type || 'mcq',
          questionText: q.questionText || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          markingScheme: q.markingScheme || '',
          points: q.points || 1,
        });
        createdQuestions.push(newQuestion);
      }
      savedCount = createdQuestions.length;
    }

    // Return preview or confirmation response
    return NextResponse.json({
      message: saveToDb
        ? `Successfully parsed and saved ${savedCount} questions to database!`
        : (parseResult.summary || 'Parsing complete'),
      questions: saveToDb ? createdQuestions : parseResult.questions,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      sections: parseResult.sections,
      detectedFormat: parseResult.detectedFormat,
      preview: !saveToDb,
      savedToDatabase: !!saveToDb,
      totalParsed: parseResult.questions.length,
      mcqCount: parseResult.questions.filter(q => q.type === 'mcq').length,
      essayCount: parseResult.questions.filter(q => q.type === 'essay').length,
    });

  } catch (error) {
    console.error('Parse questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}