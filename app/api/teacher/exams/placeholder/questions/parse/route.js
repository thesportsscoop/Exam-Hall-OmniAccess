import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';
import { parseQuestions } from '@/lib/question-parser/index.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/exams/placeholder/questions/parse
 * Parse raw text into structured questions using the modular parser pipeline
 * Returns intermediate structured object (does NOT save to database)
 */
export async function POST(request) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const body = await request.json();
    const { text, examFormat = 'hybrid' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Run the modular parser pipeline
    const parseResult = await parseQuestions(text);

    // Return the intermediate structured object
    return NextResponse.json({
      success: true,
      message: parseResult.summary || 'Parsing complete',
      metadata: parseResult.metadata,
      questions: parseResult.questions,
      sections: parseResult.sections,
      summary: parseResult.summary,
      validation: parseResult.validation,
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      detectedFormat: parseResult.detectedFormat,
      preview: true,
    });

  } catch (error) {
    console.error('Parse questions error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}