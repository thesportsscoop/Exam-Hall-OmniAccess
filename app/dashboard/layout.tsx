import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import TeacherNav from './TeacherNav';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const decoded = await getAuthUser();

  if (!decoded || typeof decoded === 'string') {
    redirect('/login');
  }

  await dbConnect();
  const user = await User.findById(decoded.id);

  if (!user || user.role !== 'teacher') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNav user={{ name: user.name, email: user.email }} />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}