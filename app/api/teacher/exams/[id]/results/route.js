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

    // Group by class
    const byClass = submissions.reduce((acc, sub) => {
      const cls = sub.classGroup || 'No Class';
      if (!acc[cls]) acc[cls] = [];
      acc[cls].push(sub);
      return acc;
    }, {});

    // Calculate analytics
    const totalSubmissions = submissions.length;
    const avgScore = totalSubmissions > 0
      ? Math.round(submissions.reduce((sum, s) => sum + s.score, 0) / totalSubmissions)
      : 0;
    const avgPercentage = totalSubmissions > 0
      ? Math.round(submissions.reduce((sum, s) => sum + (s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0), 0) / totalSubmissions)
      : 0;

    // Score distribution
    const distribution = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      '50-59': 0,
      '0-49': 0,
    };

    submissions.forEach((s) => {
      const pct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      if (pct >= 90) distribution['90-100']++;
      else if (pct >= 80) distribution['80-89']++;
      else if (pct >= 70) distribution['70-79']++;
      else if (pct >= 60) distribution['60-69']++;
      else if (pct >= 50) distribution['50-59']++;
      else distribution['0-49']++;
    });

    return NextResponse.json({
      submissions,
      byClass,
      analytics: {
        totalSubmissions,
        avgScore,
        avgPercentage,
        distribution,
      },
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}