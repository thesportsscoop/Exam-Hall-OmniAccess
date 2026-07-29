import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ 
      connected: true, 
      database: 'alta-vista',
      message: 'MongoDB connection successful'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        connected: false, 
        error: error.message || 'Failed to connect to MongoDB',
        message: 'Database connection failed'
      },
      { status: 500 }
    );
  }
}