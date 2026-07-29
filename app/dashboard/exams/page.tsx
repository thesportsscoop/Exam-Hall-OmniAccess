import { redirect } from 'next/navigation';
import Link from 'next/link';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Submission from '@/models/Submission';
import { getAuthUser } from '@/lib/auth';

async function getTeacherExams(teacherId: string) {
  await dbConnect();

  const exams = await Exam.find({ teacherId })
    .sort({ createdAt: -1 })
    .lean();

  return Promise.all(
    exams.map(async (exam: any) => {
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
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
        passkey: exam.passkey,
        classes: exam.classes,
        isPaid: exam.isPaid,
        isActive: exam.isActive,
        submissionCount,
        status,
        createdAt: exam.createdAt,
      };
    })
  );
}

export default async function TeacherExams() {
  const decoded = await getAuthUser();
  if (!decoded || typeof decoded === 'string' || decoded.role !== 'teacher') {
    redirect('/login');
  }

  const exams = await getTeacherExams(decoded.id);

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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Exams</h1>
          <p className="text-gray-600 mt-1">Manage your exams and their questions</p>
        </div>
        <Link
          href="/dashboard/exams/create"
          className="btn btn-primary"
        >
          Create New Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No exams yet</h3>
          <p className="text-gray-500 mb-6">Create your first exam to get started. There is a one-time fee of GHS 100 per exam.</p>
          <Link href="/dashboard/exams/create" className="btn btn-primary">
            Create New Exam
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Format</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Submissions</th>
                  <th className="px-6 py-4 font-medium">Payment</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam, index) => (
                  <tr
                    key={exam._id}
                    className={`border-b border-gray-100 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {exam.title}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(exam.status)}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {exam.submissionCount}
                    </td>
                    <td className="px-6 py-4 text-sm">
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
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/exams/${exam._id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}