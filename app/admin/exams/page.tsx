'use client';

import { useState, useEffect } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Exam {
  _id: string;
  title: string;
  teacherName: string;
  teacherEmail: string;
  format: string;
  durationMinutes: number;
  status: string;
  submissionCount: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    durationMinutes: 60,
    startTime: '',
    endTime: '',
    passkey: '',
    format: 'mcq',
    teacherId: '',
  });

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/admin/exams');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create exam');
        return;
      }

      toast.success('Exam created successfully');
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        durationMinutes: 60,
        startTime: '',
        endTime: '',
        passkey: '',
        format: 'mcq',
        teacherId: '',
      });
      fetchExams();
    } catch (error) {
      toast.error('Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (!confirm('Are you sure? This will delete the exam and all submissions permanently.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/exams?id=${examId}`, {
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

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Exams</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary text-sm"
          >
            {showForm ? 'Cancel' : 'Create Exam'}
          </button>
          <Link
            href="/admin"
            className="btn btn-outline text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Exam</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Exam Title *</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="Midterm Exam"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Passkey *</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="EXAM2024"
                  value={formData.passkey}
                  onChange={(e) => setFormData({ ...formData, passkey: e.target.value.toUpperCase() })}
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="label">Duration (minutes) *</label>
                <input
                  type="number"
                  className="input mt-1"
                  placeholder="60"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                  required
                  min={1}
                />
              </div>
              <div>
                <label className="label">Format</label>
                <select
                  className="input mt-1"
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="essay">Essay</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="label">Start Time *</label>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">End Time *</label>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input mt-1"
                placeholder="Exam description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Create Exam'}
            </button>
          </form>
        </div>
      )}

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
                <th className="px-6 py-4 font-medium text-right">Actions</th>
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(exam.status)}`}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {exam.submissionCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(exam._id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {exams.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-sm text-gray-500 text-center">
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