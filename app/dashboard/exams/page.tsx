'use client';

import { useState, useEffect } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Exam {
  _id: string;
  title: string;
  format: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  passkey: string;
  isPaid: boolean;
  submissionCount: number;
  status: string;
}

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load exams');
        return;
      }
      setExams(data.exams);
    } catch (error) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/teacher/exams/${editingExam._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingExam),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update exam');
        return;
      }

      toast.success('Exam updated successfully');
      setEditingExam(null);
      fetchExams();
    } catch (error) {
      toast.error('Failed to update exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (!confirm('Are you sure? This will delete the exam and all questions permanently.')) {
      return;
    }

    try {
      const res = await fetch(`/api/teacher/exams/${examId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete exam');
        return;
      }

      toast.success('Exam deleted');
      fetchExams();
    } catch (error) {
      toast.error('Failed to delete exam');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const updateExamField = (field: keyof Exam, value: any) => {
    if (!editingExam) return;
    setEditingExam({ ...editingExam, [field]: value });
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(exam)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(exam._id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Exam</h3>
              <button
                onClick={() => setEditingExam(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="label">Exam Title</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={editingExam.title}
                  onChange={(e) => updateExamField('title', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={editingExam.durationMinutes}
                    onChange={(e) => updateExamField('durationMinutes', parseInt(e.target.value) || 0)}
                    required
                    min={1}
                  />
                </div>
                <div>
                  <label className="label">Format</label>
                  <select
                    className="input mt-1"
                    value={editingExam.format}
                    onChange={(e) => updateExamField('format', e.target.value)}
                  >
                    <option value="mcq">MCQ</option>
                    <option value="essay">Essay</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="datetime-local"
                    className="input mt-1"
                    value={editingExam.startTime.slice(0, 16)}
                    onChange={(e) => updateExamField('startTime', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input
                    type="datetime-local"
                    className="input mt-1"
                    value={editingExam.endTime.slice(0, 16)}
                    onChange={(e) => updateExamField('endTime', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Passkey</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={editingExam.passkey}
                  onChange={(e) => updateExamField('passkey', e.target.value.toUpperCase())}
                  required
                  minLength={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPaid"
                  checked={editingExam.isPaid}
                  onChange={(e) => updateExamField('isPaid', e.target.checked)}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="isPaid" className="text-sm text-gray-700">
                  Payment completed
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
