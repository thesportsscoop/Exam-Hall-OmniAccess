import { NextResponse } from 'next/server';
import { seedSuperAdmin } from '@/lib/seed';

export async function POST() {
  try {
    const admin = await seedSuperAdmin();
    return NextResponse.json({
      message: admin ? 'Super Admin seeded successfully' : 'Super Admin already exists',
      email: 'eddy@altavista.com',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed Super Admin' },
      { status: 500 }
    );
  }
}