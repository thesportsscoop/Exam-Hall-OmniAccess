import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';
import { parseQuestions } from '@/lib/question-parser/index.js';

/**
 * POST /api/teacher/exams/[id]/questions/parse
 * Multi-stage pipeline:
 * 1. Normalize text
 * 2. Detect sections
 * 3. Parse with dedicated parsers (MCQ, Essay)
 * 4. AI Validation
 * Returns preview WITHOUT saving to database.
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
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Run the multi-stage parsing pipeline
    const parseResult = await parseQuestions(text);

    // Return preview (does NOT save to database)
    return NextResponse.json({
      message: parseResult.summary || 'Parsing complete',
      questions: parseResult.questions,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      sections: parseResult.sections,
      detectedFormat: parseResult.detectedFormat,
      // Preview mode - no saving
      preview: true,
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