import { NextResponse } from 'next/server';
import Submission from '@/models/Submission';
import dbConnect from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const submissions = await Submission.find({ examId: params.id })
      .sort({ submittedAt: -1 })
      .lean();

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}