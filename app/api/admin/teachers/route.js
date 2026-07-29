import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const decoded = await getAuthUser(request);
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const teachers = await User.find({ role: 'teacher' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Get exam count for each teacher
    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const examCount = await Exam.countDocuments({
          teacherId: teacher._id,
        });
        return {
          ...teacher,
          _id: teacher._id.toString(),
          examCount,
        };
      })
    );

    return NextResponse.json({ teachers: teachersWithStats });
  } catch (error) {
    console.error('Admin teachers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const decoded = await getAuthUser(request);
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create teacher user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'teacher',
    });

    return NextResponse.json({
      message: 'Teacher created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    return NextResponse.json(
      { error: 'Failed to create teacher' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const decoded = await getAuthUser(request);
    if (!decoded || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('id');

    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Delete teacher and their exams
    await User.findByIdAndDelete(teacherId);
    await Exam.deleteMany({ teacherId });

    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    return NextResponse.json(
      { error: 'Failed to delete teacher' },
      { status: 500 }
    );
  }
}
