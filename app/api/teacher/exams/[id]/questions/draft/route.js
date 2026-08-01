import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Exam from '@/models/Exam';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { questions } = await request.json();

    await connectToDatabase();

    const exam = await Exam.findById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (exam.teacher.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Store draft in exam document
    exam.draftQuestions = questions;
    exam.draftSavedAt = new Date();
    await exam.save();

    return NextResponse.json({ success: true, message: 'Draft saved' });
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    await connectToDatabase();

    const exam = await Exam.findById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (exam.teacher.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Return draft if it exists and is less than 24 hours old
    if (exam.draftQuestions && exam.draftSavedAt) {
      const hoursSinceSave = (new Date() - new Date(exam.draftSavedAt)) / (1000 * 60 * 60);
      if (hoursSinceSave < 24) {
        return NextResponse.json({ questions: exam.draftQuestions });
      }
    }

    return NextResponse.json({ questions: [] });
  } catch (error) {
    console.error('Error loading draft:', error);
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 });
  }
}