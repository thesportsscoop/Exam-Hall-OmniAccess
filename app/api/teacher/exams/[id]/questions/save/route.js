import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/teacher/exams/[id]/questions/save
 * Saves reviewed and edited questions from the preview screen.
 * Receives the final array of questions as edited by the teacher.
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
    const { questions, sections } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions provided to save' },
        { status: 400 }
      );
    }

    // Save sections first if provided
    if (sections && Array.isArray(sections) && sections.length > 0) {
      try {
        await Exam.findByIdAndUpdate(params.id, { sections });
      } catch (sectionError) {
        console.error('Failed to save sections:', sectionError);
        // Continue with saving questions even if sections fail
      }
    }

    // Validate and save each question
    const savedQuestions = [];
    const errors = [];
    let questionOrder = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      // Validate required fields
      if (!q.type || !['mcq', 'essay', 'true_false', 'fill_blank', 'short_answer'].includes(q.type)) {
        errors.push(`Question ${i + 1}: Invalid type "${q.type}"`);
        continue;
      }

      if (!q.questionText || q.questionText.trim().length === 0) {
        errors.push(`Question ${i + 1}: Question text is required`);
        continue;
      }

      if (q.type === 'mcq') {
        if (!q.options || q.options.length < 2) {
          errors.push(`Question ${i + 1}: MCQ must have at least 2 options`);
          continue;
        }
        if (!q.correctAnswer) {
          errors.push(`Question ${i + 1}: MCQ must have a correct answer`);
          continue;
        }
      }

      if (q.type === 'essay' && (!q.markingScheme || q.markingScheme.trim().length === 0)) {
        // Auto-generate a marking scheme if missing
        q.markingScheme = `Marking Scheme (Total: ${q.points || 10} marks):\n\n` +
          `Expected Key Points:\n` +
          `- Award marks for each correct key point mentioned\n` +
          `- Credit well-structured and clearly explained answers\n\n` +
          `Marking Guidelines:\n` +
          `- Full marks (${q.points || 10} pts): Complete, accurate, well-explained answer\n` +
          `- 0 pts: No attempt or completely off-topic\n`;
      }

      try {
        const question = await Question.create({
          examId: params.id,
          type: q.type,
          questionText: q.questionText.trim(),
          options: q.type === 'mcq' ? (q.options || []) : [],
          correctAnswer: ['mcq', 'true_false', 'fill_blank'].includes(q.type) ? (q.correctAnswer || '') : '',
          markingScheme: ['essay', 'short_answer'].includes(q.type) ? (q.markingScheme || '') : '',
          points: q.points || 1,
          section: q.section || '',
          sectionOrder: questionOrder++,
        });

        savedQuestions.push({
          _id: question._id.toString(),
          type: question.type,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          markingScheme: question.markingScheme,
          points: question.points,
          section: question.section,
        });
      } catch (createError) {
        errors.push(`Question ${i + 1}: Failed to save - ${createError.message}`);
      }
    }

    const mcqCount = savedQuestions.filter(q => q.type === 'mcq').length;
    const essayCount = savedQuestions.filter(q => q.type === 'essay').length;

    return NextResponse.json({
      message: `Successfully saved ${savedQuestions.length} questions${sections?.length ? ` in ${sections.length} sections` : ''}`,
      questions: savedQuestions,
      errors: errors.length > 0 ? errors : undefined,
      saveInfo: {
        totalSaved: savedQuestions.length,
        mcqCount,
        essayCount,
        errorCount: errors.length,
        sectionsSaved: sections?.length || 0,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Save questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}