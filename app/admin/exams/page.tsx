import { redirect } from 'next/navigation';
import Link from 'next/link';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

export default async function AdminExams() {
  const decoded = await getAuthUser();
  if (!decoded || typeof decoded === 'string' || decoded.role !== 'super_admin') {
    redirect('/login');
  }

  await dbConnect();

  const exams = await Exam.find({})
    .populate('teacherId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const examsWithStats = await Promise.all(
    (exams as any[]).map(async (exam) => {
      const submissionCount = await Submission.countDocuments({
        examId: exam._id,
      });
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
        teacherName: exam.teacherId?.name || 'Unknown',
        teacherEmail: exam.teacherId?.email || '',
        format: exam.format,
        durationMinutes: exam.durationMinutes,
        submissionCount,
        status,
        startTime: exam.startTime,
        endTime: exam.endTime,
        createdAt: exam.createdAt,
      };
    })
  );

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Exams</h1>
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
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Teacher</th>
                <th className="px-6 py-4 font-medium">Format</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Submissions</th>
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {examsWithStats.map((exam, index) => (
                <tr
                  key={exam._id}
                  className={`border-b border-gray-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                    {exam.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{exam.teacherName}</div>
                    <div className="text-xs text-gray-400">{exam.teacherEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                      {exam.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {exam.durationMinutes} min
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                        exam.status
                      )}`}
                    >
                      {exam.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {exam.submissionCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {examsWithStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-sm text-gray-500 text-center">
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