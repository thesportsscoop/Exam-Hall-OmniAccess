import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

// GET: Get all exams for the logged-in teacher
export async function GET() {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exams = await Exam.find({ teacherId: decoded.id })
      .sort({ createdAt: -1 })
      .lean();

    const examsWithStats = await Promise.all(
      exams.map(async (exam) => {
        const submissionCount = await Submission.countDocuments({ examId: exam._id });
        const now = new Date();
        let status = 'upcoming';
        if (now >= new Date(exam.startTime) && now <= new Date(exam.endTime)) {
          status = 'active';
        } else if (now > new Date(exam.endTime)) {
          status = 'ended';
        }
        return {
          _id: exam._id.toString(),
          title: exam.title,
          description: exam.description,
          format: exam.format,
          durationMinutes: exam.durationMinutes,
          startTime: exam.startTime,
          endTime: exam.endTime,
          passkey: exam.passkey,
          classes: exam.classes,
          isPaid: exam.isPaid,
          isActive: exam.isActive,
          submissionCount,
          status,
          createdAt: exam.createdAt,
        };
      })
    );

    return NextResponse.json({ exams: examsWithStats });
  } catch (error) {
    console.error('Teacher exams error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new exam (requires payment)
export async function POST(request) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      subject,
      academicYear,
      term,
      department,
      durationMinutes,
      startTime,
      endTime,
      timezone,
      passkey,
      format,
      classes,
      isPaid,
      availabilityType,
      lateSubmissionPolicy,
      maxAttempts,
      oneDeviceOnly,
      randomizeQuestions,
      randomizeOptions,
      shuffleStudents,
      showTimer,
      autoSubmit,
      preventCopyPaste,
      requireFullscreen,
      showScoreImmediately,
      showCorrectAnswers,
      showExplanations,
      hideResults,
      releaseResultsLater,
      releaseDate,
      certificateAfterCompletion,
    } = body;

    // Validate required fields
    if (!title || !durationMinutes || !startTime || !endTime || !passkey) {
      return NextResponse.json(
        { error: 'Title, duration, start time, end time, and passkey are required' },
        { status: 400 }
      );
    }

    if (passkey.length < 4) {
      return NextResponse.json(
        { error: 'Passkey must be at least 4 characters' },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if passkey is unique
    const existingExam = await Exam.findOne({ passkey });
    if (existingExam) {
      return NextResponse.json(
        { error: 'This passkey is already in use. Please choose another.' },
        { status: 409 }
      );
    }

    const exam = await Exam.create({
      teacherId: decoded.id,
      title,
      description: description || '',
      subject: subject || '',
      academicYear: academicYear || '',
      term: term || '',
      department: department || '',
      durationMinutes,
      startTime: startDate,
      endTime: endDate,
      timezone: timezone || 'UTC',
      passkey,
      format: format || 'mcq',
      classes: classes || [],
      isPaid: isPaid || false,
      availabilityType: availabilityType || 'anytime',
      lateSubmissionPolicy: lateSubmissionPolicy || 'reject',
      maxAttempts: maxAttempts || 1,
      oneDeviceOnly: oneDeviceOnly || false,
      randomizeQuestions: randomizeQuestions || false,
      randomizeOptions: randomizeOptions || false,
      shuffleStudents: shuffleStudents || false,
      showTimer: showTimer !== undefined ? showTimer : true,
      autoSubmit: autoSubmit !== undefined ? autoSubmit : true,
      preventCopyPaste: preventCopyPaste || false,
      requireFullscreen: requireFullscreen || false,
      showResults: showScoreImmediately || false,
      showScoreImmediately: showScoreImmediately || false,
      showCorrectAnswers: showCorrectAnswers || false,
      showExplanations: showExplanations || false,
      hideResults: hideResults !== undefined ? hideResults : true,
      releaseResultsLater: releaseResultsLater || false,
      releaseDate: releaseResultsLater && releaseDate ? new Date(releaseDate) : null,
      certificateAfterCompletion: certificateAfterCompletion || false,
    });

    return NextResponse.json(
      {
        exam: {
          _id: exam._id.toString(),
          title: exam.title,
          format: exam.format,
          isPaid: exam.isPaid,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create exam error:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'This passkey is already in use. Please choose another.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}