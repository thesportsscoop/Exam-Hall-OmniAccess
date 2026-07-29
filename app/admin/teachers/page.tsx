import { redirect } from 'next/navigation';
import Link from 'next/link';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';

export default async function AdminTeachers() {
  const decoded = await getAuthUser();
  if (!decoded || typeof decoded === 'string' || decoded.role !== 'super_admin') {
    redirect('/login');
  }

  await dbConnect();

  const teachers = await User.find({ role: 'teacher' })
    .select('name email createdAt')
    .sort({ createdAt: -1 })
    .lean();

  // Get exam counts
  const teachersWithStats = await Promise.all(
    (teachers as any[]).map(async (teacher) => {
      const examCount = await Exam.countDocuments({ teacherId: teacher._id });
      return {
        _id: teacher._id.toString(),
        name: teacher.name,
        email: teacher.email,
        createdAt: teacher.createdAt,
        examCount,
      };
    })
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teachers</h1>
        <Link
          href="/admin"
          className="btn btn-outline text-sm"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Exams Created</th>
                <th className="px-6 py-4 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {teachersWithStats.map((teacher, index) => (
                <tr
                  key={teacher._id}
                  className={`border-b border-gray-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {teacher.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {teacher.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {teacher.examCount} exams
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(teacher.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {teachersWithStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-sm text-gray-500 text-center">
                    No teachers registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}