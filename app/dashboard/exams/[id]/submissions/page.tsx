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
  answers: {
    questionId: string;
    answer: string;
    isCorrect: boolean | null;
    pointsAwarded: number;
  }[];
}

export default function SubmissionsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, [examId]);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/submissions`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load submissions');
        return;
      }
      setSubmissions(data.submissions);
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-600 mt-1">View student exam results</p>
        </div>
        <button
          onClick={() => router.push(`/dashboard/exams/${examId}`)}
          className="btn btn-outline text-sm"
        >
          Back to Exam
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
          <p className="text-gray-500">No students have taken this exam yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => {
            const percentage = sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0;
            return (
              <div key={sub._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedSubmission(selectedSubmission?._id === sub._id ? null : sub)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {sub.studentName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sub.studentName}</p>
                        <p className="text-xs text-gray-500">
                          {sub.classGroup && `${sub.classGroup} · `}
                          {new Date(sub.submittedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sub.isGraded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sub.isGraded ? 'Graded' : 'Pending Review'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {sub.score}/{sub.maxScore} ({percentage}%)
                      </span>
                    </div>
                  </div>
                </div>

                {selectedSubmission?._id === sub._id && (
                  <div className="border-t border-gray-200 p-5 bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Answers</h4>
                    <div className="space-y-2">
                      {sub.answers.map((ans, i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500">Question {i + 1}</span>
                            <span className={`text-xs font-medium ${
                              ans.isCorrect === true ? 'text-green-600' :
                              ans.isCorrect === false ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                              {ans.isCorrect === true ? 'Correct' :
                               ans.isCorrect === false ? 'Incorrect' :
                               'Pending Review'}
                              {' · '}{ans.pointsAwarded} pts
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {ans.answer || '(No answer provided)'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}