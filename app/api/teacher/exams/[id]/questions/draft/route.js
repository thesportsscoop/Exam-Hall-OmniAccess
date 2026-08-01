import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';

export async function POST(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    const { questions } = await request.json();

    await dbConnect();

    const exam = await Exam.findOne({ _id: id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
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
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;

    await dbConnect();

    const exam = await Exam.findOne({ _id: id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
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