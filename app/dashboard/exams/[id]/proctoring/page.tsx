'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface ProctoringEvent {
  type: string;
  severity: 'info' | 'warning' | 'violation';
  timestamp: string;
  details: string;
  confidence: number;
}

interface ProctoringSession {
  _id: string;
  studentName: string;
  status: string;
  violationCount: number;
  warningCount: number;
  events: ProctoringEvent[];
  identityVerification: {
    verified: boolean;
    verifiedAt: string;
    confidence: number;
  };
  environmentScan: {
    completed: boolean;
    notes: string;
  };
  startedAt: string;
  endedAt: string;
  createdAt: string;
}

export default function ProctoringReportsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [examTitle, setExamTitle] = useState('');
  const [sessions, setSessions] = useState<ProctoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSessions: 0, flaggedSessions: 0, completedSessions: 0 });
  const [selectedSession, setSelectedSession] = useState<ProctoringSession | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchProctoringData();
  }, [examId]);

  const fetchProctoringData = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/proctoring`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to load proctoring data');
        router.push(`/dashboard/exams/${examId}`);
        return;
      }

      setExamTitle(data.examTitle);
      setSessions(data.sessions);
      setStats({
        totalSessions: data.totalSessions,
        flaggedSessions: data.flaggedSessions,
        completedSessions: data.completedSessions,
      });
    } catch (error) {
      toast.error('Failed to load proctoring data');
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      flagged: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getEventBadge = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-50 text-blue-700 border-blue-200',
      warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      violation: 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[severity] || 'bg-gray-50 text-gray-700';
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'face_missing':
        return '👤';
      case 'multiple_faces':
        return '👥';
      case 'gaze_away':
        return '👀';
      case 'speaking_detected':
        return '🗣️';
      case 'phone_detected':
      case 'object_detected':
        return '📱';
      case 'tab_switch':
        return '🔄';
      case 'identity_verified':
        return '✅';
      case 'environment_scan_complete':
        return '📷';
      default:
        return '📌';
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
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proctoring Reports</h1>
          <p className="text-gray-600 mt-1">{examTitle}</p>
        </div>
        <button
          onClick={() => router.push(`/dashboard/exams/${examId}`)}
          className="btn btn-outline text-sm"
        >
          Back to Exam
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Sessions</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completedSessions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Flagged</p>
          <p className={`text-2xl font-bold ${stats.flaggedSessions > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.flaggedSessions}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Clear Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalSessions > 0
              ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'completed', 'flagged', 'in_progress'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All Sessions' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No proctoring sessions</h3>
          <p className="text-gray-500">No students have taken this exam yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session._id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedSession(selectedSession?._id === session._id ? null : session)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {session.studentName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{session.studentName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}>
                      {session.status.replace('_', ' ')}
                    </span>
                    {session.violationCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {session.violationCount} violation{session.violationCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {session.warningCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {session.warningCount} warning{session.warningCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${selectedSession?._id === session._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedSession?._id === session._id && (
                <div className="border-t border-gray-200 p-5 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Identity Verification */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Identity Verification</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Status</span>
                          <span className={`font-medium ${session.identityVerification?.verified ? 'text-green-600' : 'text-red-600'}`}>
                            {session.identityVerification?.verified ? 'Verified ✓' : 'Not Verified'}
                          </span>
                        </div>
                        {session.identityVerification?.verifiedAt && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Verified At</span>
                            <span className="text-gray-900">{new Date(session.identityVerification.verifiedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {session.identityVerification?.confidence > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Confidence</span>
                            <span className="text-gray-900">{session.identityVerification.confidence}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Environment Scan */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Environment Scan</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Status</span>
                          <span className={`font-medium ${session.environmentScan?.completed ? 'text-green-600' : 'text-yellow-600'}`}>
                            {session.environmentScan?.completed ? 'Completed ✓' : 'Pending'}
                          </span>
                        </div>
                        {session.environmentScan?.notes && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Notes</span>
                            <span className="text-gray-900">{session.environmentScan.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event Timeline */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Event Timeline</h4>
                    {session.events.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No events recorded</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {session.events.map((event, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-3 p-2 rounded border ${getEventBadge(event.severity)}`}
                          >
                            <span className="text-lg">{getEventIcon(event.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium uppercase">
                                  {event.type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs mt-0.5">{event.details}</p>
                              {event.confidence > 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Confidence: {event.confidence}%
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Session Summary */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>Started: {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'N/A'}</span>
                      <span>Ended: {session.endedAt ? new Date(session.endedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'flagged' && (
                        <button
                          onClick={() => {
                            fetch(`/api/proctoring/sessions/${session._id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'completed' }),
                            }).then(() => {
                              toast.success('Session marked as reviewed');
                              fetchProctoringData();
                            });
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                        >
                          Mark as Reviewed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}