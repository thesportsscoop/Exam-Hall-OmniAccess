import { redirect } from 'next/navigation';
import Link from 'next/link';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

async function getTeacherStats(teacherId: string) {
  await dbConnect();

  const [totalExams, totalSubmissions, activeExams] = await Promise.all([
    Exam.countDocuments({ teacherId }),
    Submission.countDocuments({ examId: { $in: await Exam.find({ teacherId }).distinct('_id') } }),
    Exam.countDocuments({
      teacherId,
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    }),
  ]);

  // Get recent exams
  const recentExams = await Exam.find({ teacherId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const recentExamsWithStats = await Promise.all(
    (recentExams as any[]).map(async (exam) => {
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
        format: exam.format,
        isPaid: exam.isPaid,
        submissionCount,
        status,
        createdAt: exam.createdAt,
      };
    })
  );

  return { totalExams, totalSubmissions, activeExams, recentExams: recentExamsWithStats };
}

export default async function TeacherDashboard() {
  const decoded = await getAuthUser();
  if (!decoded || typeof decoded === 'string' || decoded.role !== 'teacher') {
    redirect('/login');
  }

  const stats = await getTeacherStats(decoded.id);

  const statCards = [
    {
      title: 'Total Exams',
      value: stats.totalExams,
      color: 'bg-blue-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Active Exams',
      value: stats.activeExams,
      color: 'bg-green-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Total Submissions',
      value: stats.totalSubmissions,
      color: 'bg-purple-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {decoded.name}</p>
        </div>
        <Link
          href="/dashboard/exams/create"
          className="btn btn-primary"
        >
          Create New Exam
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Recent Exams */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Exams</h2>
          <Link
            href="/dashboard/exams"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Format</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Submissions</th>
                <th className="pb-3 font-medium">Payment</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentExams.map((exam) => (
                <tr key={exam._id} className="border-b border-gray-100">
                  <td className="py-3 text-sm text-gray-900">{exam.title}</td>
                  <td className="py-3 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                      {exam.format}
                    </span>
                  </td>
                  <td className="py-3 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      exam.status === 'active' ? 'bg-green-100 text-green-800' :
                      exam.status === 'ended' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-900">{exam.submissionCount}</td>
                  <td className="py-3 text-sm">
                    {exam.isPaid ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentExams.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-gray-500 text-center">
                    No exams yet. Click "Create New Exam" to get started!
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