'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface AdminNavProps {
  user: {
    name: string;
    email: string;
  };
}

export default function AdminNav({ user }: AdminNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        toast.success('Logged out successfully');
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/admin"
              className="text-xl font-bold text-gray-900"
            >
              Exam Hall OmniAccess
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/admin"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/teachers"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Teachers
              </Link>
              <Link
                href="/admin/exams"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Exams
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-outline text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}