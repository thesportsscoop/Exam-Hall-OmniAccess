import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';
import { parseQuestions } from '@/lib/ai-parser.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/exams/[id]/questions/parse
 * AI-Powered Question Parser:
 * 1. Sends text to Gemini AI for structured parsing
 * 2. Returns parsed questions (MCQ and/or Essay) with marking schemes
 * 3. Supports preview mode or direct database saving when saveToDb is true.
 *
 * The AI parser:
 * - Parses pasted text into MCQ and Essay questions
 * - Extracts marking schemes if provided in the text
 * - Auto-generates marking schemes for essay questions when not provided
 * - Accepts text extracted from PDF, DOCX, TXT, and image files (OCR)
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
    const { text, saveToDb, examFormat } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Run the AI-powered parsing pipeline
    const parseResult = await parseQuestions(text, examFormat || exam.format || 'hybrid');

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
