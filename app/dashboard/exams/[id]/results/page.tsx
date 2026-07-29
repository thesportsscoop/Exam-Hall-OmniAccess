'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface Submission {
  _id: string;
  studentName: string;
  classGroup: string;
  score: number;
  maxScore: number;
  isGraded: boolean;
  submittedAt: string;
}

interface Analytics {
  totalSubmissions: number;
  avgScore: number;
  avgPercentage: number;
  distribution: Record<string, number>;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [byClass, setByClass] = useState<Record<string, Submission[]>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');

  useEffect(() => {
    fetchResults();
  }, [examId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/results`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load results');
        return;
      }
      setSubmissions(data.submissions);
      setByClass(data.byClass);
      setAnalytics(data.analytics);
    } catch (error) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const subsToExport = selectedClass === 'all' ? submissions : byClass[selectedClass] || [];

    if (subsToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Student Name', 'Class', 'Score', 'Max Score', 'Percentage', 'Submitted At'];
    const rows = subsToExport.map((s) => [
      s.studentName,
      s.classGroup || 'No Class',
      s.score,
      s.maxScore,
      s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) + '%' : '0%',
      new Date(s.submittedAt).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${examId}${selectedClass !== 'all' ? `-${selectedClass}` : ''}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success('Results exported successfully');
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getBarColor = (range: string) => {
    if (range === '90-100') return 'bg-green-500';
    if (range === '80-89') return 'bg-blue-500';
    if (range === '70-79') return 'bg-yellow-500';
    if (range === '60-69') return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const displayedSubmissions = selectedClass === 'all' ? submissions : byClass[selectedClass] || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-gray-600 mt-1">Performance analytics and grade distribution</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn btn-outline text-sm">
            Export CSV
          </button>
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}`)}
            className="btn btn-outline text-sm"
          >
            Back to Exam
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Submissions</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.totalSubmissions}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Average Score</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.avgScore} pts</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Average Percentage</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.avgPercentage}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Classes</p>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(byClass).length}</p>
          </div>
        </div>
      )}

      {/* Score Distribution Chart */}
      {analytics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.distribution).map(([range, count]) => {
              const maxCount = Math.max(...Object.values(analytics.distribution));
              const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={range} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-gray-600 text-right">{range}%</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${getBarColor(range)} flex items-center justify-end px-2 transition-all`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {count > 0 && <span className="text-xs text-white font-medium">{count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Class Filter */}
      {Object.keys(byClass).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Classes</option>
              {Object.keys(byClass).map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({byClass[cls].length})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Submissions {selectedClass !== 'all' && `- ${selectedClass}`}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{displayedSubmissions.length} students</p>
        </div>

        {displayedSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
            <p className="text-gray-500">Results will appear here once students submit their exams.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Percentage</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedSubmissions.map((sub) => {
                  const percentage = sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0;
                  return (
                    <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-700">
                              {sub.studentName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{sub.studentName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{sub.classGroup || 'No Class'}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {sub.score}/{sub.maxScore}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPercentageColor(percentage)}`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sub.isGraded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sub.isGraded ? 'Graded' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}