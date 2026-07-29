import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import AdminNav from './AdminNav';

export default async function AdminLayout({
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

  if (!user || user.role !== 'super_admin') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav user={{ name: user.name, email: user.email }} />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}