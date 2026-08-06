import { NextResponse } from 'next/server';
import Submission from '@/models/Submission';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import dbConnect from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, submissionId } = params;

    await dbConnect();
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const exam = await Exam.findById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (exam.teacherId.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const questions = await Question.find({ examId: id }).sort({ createdAt: 1 }).lean();

    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    const answersWithQuestions = (submission.answers || []).map((a) => {
      const q = questionMap.get(a.questionId);
      return {
        ...a,
        question: q || null,
      };
    });

    return NextResponse.json({
      submission: {
        _id: submission._id,
        studentName: submission.studentName,
        classGroup: submission.classGroup,
        score: submission.score,
        maxScore: submission.maxScore,
        isGraded: submission.isGraded,
        submittedAt: submission.submittedAt,
        answers: answersWithQuestions,
      },
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
  }
}