import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

async function getAdminStats() {
  await dbConnect();

  const [totalTeachers, totalExams, totalSubmissions, activeExams] =
    await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      Exam.countDocuments(),
      Submission.countDocuments(),
      Exam.countDocuments({
        isActive: true,
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
      }),
    ]);

  // Get recent teachers
  const recentTeachers = await User.find({ role: 'teacher' })
    .select('name email createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // Get recent exams
  const recentExams = await Exam.find({})
    .populate('teacherId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    totalTeachers,
    totalExams,
    totalSubmissions,
    activeExams,
    recentTeachers: (recentTeachers as any[]).map((t) => ({
      _id: t._id.toString(),
      name: t.name,
      email: t.email,
      createdAt: t.createdAt,
    })),
    recentExams: (recentExams as any[]).map((e) => ({
      _id: e._id.toString(),
      title: e.title,
      teacherName: e.teacherId?.name || 'Unknown',
      format: e.format,
      submissionCount: 0,
      createdAt: e.createdAt,
    })),
  };
}

export default async function AdminDashboard() {
  const decoded = await getAuthUser();
  if (!decoded || typeof decoded === 'string' || decoded.role !== 'super_admin') {
    redirect('/login');
  }

  const stats = await getAdminStats();

  const statCards = [
    {
      title: 'Total Teachers',
      value: stats.totalTeachers,
      color: 'bg-blue-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'Total Exams',
      value: stats.totalExams,
      color: 'bg-green-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Active Exams',
      value: stats.activeExams,
      color: 'bg-purple-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Total Submissions',
      value: stats.totalSubmissions,
      color: 'bg-orange-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Admin Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} text-white p-3 rounded-lg`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Teachers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Teachers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTeachers.map((teacher) => (
                <tr key={teacher._id} className="border-b border-gray-100">
                  <td className="py-3 text-sm text-gray-900">{teacher.name}</td>
                  <td className="py-3 text-sm text-gray-600">{teacher.email}</td>
                  <td className="py-3 text-sm text-gray-600">
                    {new Date(teacher.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentTeachers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-sm text-gray-500 text-center">
                    No teachers registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Exams */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Exams
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Teacher</th>
                <th className="pb-3 font-medium">Format</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentExams.map((exam) => (
                <tr key={exam._id} className="border-b border-gray-100">
                  <td className="py-3 text-sm text-gray-900">{exam.title}</td>
                  <td className="py-3 text-sm text-gray-600">{exam.teacherName}</td>
                  <td className="py-3 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                      {exam.format}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentExams.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-sm text-gray-500 text-center">
                    No exams created yet
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