'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface Question {
  _id: string;
  type: 'mcq' | 'essay';
  questionText: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  markingScheme: string;
  points: number;
}

interface ExamData {
  _id: string;
  title: string;
  description: string;
  format: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  passkey: string;
  classes: string[];
  isPaid: boolean;
  isActive: boolean;
}

export default function ExamManagePage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionType, setQuestionType] = useState<'mcq' | 'essay'>('mcq');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState([
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [markingScheme, setMarkingScheme] = useState('');
  const [points, setPoints] = useState(1);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'upload' | 'generate'>('paste');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [previewMode, setPreviewMode] = useState<'parse' | 'generate'>('parse');

  // Editing state within preview
  const [editingPreviewIndex, setEditingPreviewIndex] = useState<number | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState<{ label: string; text: string }[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('');
  const [editMarkingScheme, setEditMarkingScheme] = useState('');
  const [editPoints, setEditPoints] = useState(1);

  useEffect(() => {
    fetchExamData();
  }, [examId]);

  const fetchExamData = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to load exam');
        router.push('/dashboard/exams');
        return;
      }

      setExam(data.exam);
      setQuestions(data.questions);
    } catch (error) {
      toast.error('Failed to load exam data');
      router.push('/dashboard/exams');
    } finally {
      setLoading(false);
    }
  };

  const resetQuestionForm = () => {
    setShowQuestionForm(false);
    setQuestionType('mcq');
    setQuestionText('');
    setOptions([
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ]);
    setCorrectAnswer('');
    setMarkingScheme('');
    setPoints(1);
    setEditingQuestionId(null);
  };

  const handleEditQuestion = (question: Question) => {
    setQuestionType(question.type);
    setQuestionText(question.questionText);
    setPoints(question.points);
    setEditingQuestionId(question._id);

    if (question.type === 'mcq') {
      const opts = [...options];
      question.options.forEach((opt, i) => {
        if (opts[i]) opts[i].text = opt.text;
      });
      setOptions(opts);
      setCorrectAnswer(question.correctAnswer);
    } else {
      setMarkingScheme(question.markingScheme);
    }

    setShowQuestionForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) {
      toast.error('Please enter question text');
      return;
    }

    if (questionType === 'mcq') {
      const filledOptions = options.filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        toast.error('Please provide at least 2 options');
        return;
      }
      if (!correctAnswer) {
        toast.error('Please select the correct answer');
        return;
      }
    }

    if (questionType === 'essay' && !markingScheme.trim()) {
      toast.error('Please provide a marking scheme/rubric');
      return;
    }

    setSavingQuestion(true);

    try {
      const method = editingQuestionId ? 'PUT' : 'POST';

      const body = editingQuestionId
        ? {
            questionId: editingQuestionId,
            questionText: questionText.trim(),
            options: questionType === 'mcq' ? options.filter((o) => o.text.trim()) : [],
            correctAnswer: questionType === 'mcq' ? correctAnswer : '',
            markingScheme: questionType === 'essay' ? markingScheme.trim() : '',
            points,
          }
        : {
            type: questionType,
            questionText: questionText.trim(),
            options: questionType === 'mcq' ? options.filter((o) => o.text.trim()) : [],
            correctAnswer: questionType === 'mcq' ? correctAnswer : '',
            markingScheme: questionType === 'essay' ? markingScheme.trim() : '',
            points,
          };

      const res = await fetch(`/api/teacher/exams/${examId}/questions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save question');
        return;
      }

      toast.success(editingQuestionId ? 'Question updated!' : 'Question added!');
      resetQuestionForm();
      fetchExamData();
    } catch (error) {
      toast.error('Failed to save question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions?questionId=${questionId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete question');
        return;
      }

      toast.success('Question deleted');
      setDeleteConfirmId(null);
      fetchExamData();
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste some questions first');
      return;
    }

    if (!exam) {
      toast.error('Exam not loaded');
      return;
    }

    setImporting(true);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: bulkText,
          examFormat: exam.format
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse questions');
        return;
      }

      // Show preview with parsed questions
      setPreviewQuestions(data.questions || []);
      setPreviewWarnings(data.warnings || []);
      setPreviewErrors(data.errors || []);
      setPreviewMode('parse');
      setShowPreview(true);
      setShowBulkImport(false);
    } catch (error) {
      toast.error('Failed to parse questions');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (previewQuestions.length === 0) {
      toast.error('No questions to save');
      return;
    }

    setSavingQuestions(true);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: previewQuestions }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save questions');
        return;
      }

      toast.success(data.message);
      setShowPreview(false);
      setPreviewQuestions([]);
      setPreviewWarnings([]);
      setPreviewErrors([]);
      setBulkText('');
      fetchExamData();
    } catch (error) {
      toast.error('Failed to save questions');
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleDeletePreviewQuestion = (index: number) => {
    setPreviewQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditPreviewQuestion = (index: number) => {
    const q = previewQuestions[index];
    setEditingPreviewIndex(index);
    setEditQuestionText(q.questionText);
    setEditPoints(q.points);
    if (q.type === 'mcq') {
      setEditOptions([...q.options]);
      setEditCorrectAnswer(q.correctAnswer);
    } else {
      setEditMarkingScheme(q.markingScheme || '');
    }
  };

  const handleSaveEditPreview = () => {
    if (editingPreviewIndex === null) return;
    const updated = [...previewQuestions];
    const q = updated[editingPreviewIndex];
    q.questionText = editQuestionText;
    q.points = editPoints;
    if (q.type === 'mcq') {
      q.options = [...editOptions];
      q.correctAnswer = editCorrectAnswer;
    } else {
      q.markingScheme = editMarkingScheme;
    }
    updated[editingPreviewIndex] = q;
    setPreviewQuestions(updated);
    setEditingPreviewIndex(null);
    toast.success('Question updated in preview');
  };

  const toggleExamActive = async () => {
    if (!exam) return;

    try {
      const res = await fetch(`/api/teacher/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !exam.isActive }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to update exam');
        return;
      }

      toast.success(`Exam ${exam.isActive ? 'deactivated' : 'activated'}`);
      fetchExamData();
    } catch (error) {
      toast.error('Failed to update exam');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Exam not found.</p>
        <button onClick={() => router.push('/dashboard/exams')} className="btn btn-outline mt-4">
          Back to Exams
        </button>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
            {exam.isPaid ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Paid
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Payment Pending
              </span>
            )}
          </div>
          <p className="text-gray-600">{exam.description || 'No description'}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleExamActive}
            className={`btn ${exam.isActive ? 'btn-outline' : 'btn-primary'} text-sm`}
          >
            {exam.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}/submissions`)}
            className="btn btn-outline text-sm"
          >
            Submissions
          </button>
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}/results`)}
            className="btn btn-outline text-sm"
          >
            Results & Analytics
          </button>
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}/proctoring`)}
            className="btn btn-outline text-sm"
          >
            Proctoring Reports
          </button>
          <button
            onClick={() => router.push('/dashboard/exams')}
            className="btn btn-outline text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {/* Exam Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Format</p>
          <p className="text-sm font-medium text-gray-900 uppercase">{exam.format}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Duration</p>
          <p className="text-sm font-medium text-gray-900">{exam.durationMinutes} min</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Questions</p>
          <p className="text-sm font-medium text-gray-900">{questions.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Points</p>
          <p className="text-sm font-medium text-gray-900">{totalPoints}</p>
        </div>
      </div>

      {/* Passkey Display */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Exam Passkey</p>
            <p className="text-lg font-mono font-bold text-gray-900">{exam.passkey}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Schedule</p>
            <p className="text-sm text-gray-900">
              {new Date(exam.startTime).toLocaleString()} - {new Date(exam.endTime).toLocaleString()}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Classes</p>
            <p className="text-sm text-gray-900">
              {exam.classes.length > 0 ? exam.classes.join(', ') : 'All classes'}
            </p>
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkImport(true)}
              className="btn btn-outline text-sm"
              disabled={!exam.isPaid}
            >
              Bulk Import
            </button>
            <button
              onClick={() => setShowQuestionForm(true)}
              className="btn btn-primary text-sm"
              disabled={!exam.isPaid}
            >
              Add Question
            </button>
          </div>
        </div>

        {!exam.isPaid && (
          <div className="p-6 bg-yellow-50 border-b border-yellow-100">
            <p className="text-sm text-yellow-800">
              Payment is required before you can add questions to this exam.
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {questions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p>No questions yet. Click "Add Question" to get started.</p>
            </div>
          ) : (
            questions.map((question, index) => (
              <div key={question._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        question.type === 'mcq' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {question.type === 'mcq' ? 'MCQ' : 'Essay'}
                      </span>
                      <span className="text-xs text-gray-500">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{question.questionText}</p>

                    {question.type === 'mcq' && question.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {question.options.map((opt) => (
                          <div
                            key={opt.label}
                            className={`text-xs px-2 py-1 rounded ${
                              opt.label === question.correctAnswer
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span className="font-medium">{opt.label}.</span> {opt.text}
                            {opt.label === question.correctAnswer && (
                              <span className="ml-1">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'essay' && question.markingScheme && (
                      <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-2">
                        <p className="text-xs font-medium text-blue-700 mb-1">Marking Rubric:</p>
                        <p className="text-xs text-blue-600 whitespace-pre-wrap">{question.markingScheme}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => handleEditQuestion(question)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit question"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirmId === question._id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteQuestion(question._id)}
                          className="text-red-600 text-xs font-medium hover:text-red-800"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-gray-400 text-xs hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(question._id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete question"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center overflow-y-auto z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mt-12 mb-12">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Questions</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a method to add questions to your exam.
                </p>
              </div>
              <button
                onClick={() => { setShowBulkImport(false); setBulkText(''); setUploadedFile(null); setGeneratePrompt(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setImportTab('paste')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  importTab === 'paste'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Paste Text
                </span>
              </button>
              <button
                onClick={() => setImportTab('upload')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  importTab === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload File
                </span>
              </button>
              <button
                onClick={() => setImportTab('generate')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  importTab === 'generate'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate
                </span>
              </button>
            </div>

            <div className="p-6">
              {/* Tab 1: Paste Text */}
              {importTab === 'paste' && (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    Paste your questions in any format. The system will automatically detect and structure them — including natural language, tabular data (CSV/TSV), sections with marks, and answer keys.
                  </p>
                  <textarea
                    rows={12}
                    className="input w-full min-h-[250px] font-mono text-xs"
                    placeholder={`Paste your questions here. Examples:

Natural Language Format:
1. Which organ produces sperm?
A) Penis
B) Testis
C) Prostate gland
D) Scrotum

Section Format:
Section A: Multiple Choice Questions (40 Marks)
1. What is 2+2?
A) 3
B) 4
C) 5
D) 6

Answer Key:
1B 2C 3A 4D

Essay Format:
Question 1
a) Define reproduction
b) Name three organs
c) State two characteristics`}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {bulkText.split('\n').filter(l => l.trim()).length} lines · {bulkText.length} characters
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowBulkImport(false); setBulkText(''); }}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkImport}
                        disabled={importing || !bulkText.trim()}
                        className="btn btn-primary"
                      >
                        {importing ? 'Importing...' : 'Import Questions'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Tab 2: Upload File */}
              {importTab === 'upload' && (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    Upload a PDF, DOCX, TXT, or image file. The system will extract text and parse questions automatically.
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    {!uploadedFile ? (
                      <>
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-500 mb-2">Drag and drop a file here, or click to browse</p>
                        <p className="text-xs text-gray-400 mb-4">Supports PDF, DOCX, TXT, PNG, JPG, GIF, BMP, WebP</p>
                        <label className="btn btn-outline cursor-pointer">
                          Browse Files
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setUploadedFile(file);
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <div>
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                            <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={() => setUploadedFile(null)}
                            className="btn btn-outline text-sm"
                          >
                            Remove
                          </button>
                          <button
                            onClick={async () => {
                              if (!uploadedFile || !exam) return;
                              setUploading(true);
                              try {
                                const formData = new FormData();
                                formData.append('file', uploadedFile);
                                const res = await fetch(`/api/teacher/exams/${examId}/questions/upload`, {
                                  method: 'POST',
                                  body: formData,
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  toast.error(data.error || 'Failed to extract text');
                                  return;
                                }
                                // Switch to paste tab with extracted text
                                setBulkText(data.text);
                                setImportTab('paste');
                                setUploadedFile(null);
                                toast.success(`Text extracted from ${data.fileName} (${data.charCount} chars)`);
                              } catch (error) {
                                toast.error('Failed to process file');
                              } finally {
                                setUploading(false);
                              }
                            }}
                            disabled={uploading}
                            className="btn btn-primary text-sm"
                          >
                            {uploading ? 'Extracting...' : 'Extract & Import'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Tab 3: Generate Questions */}
              {importTab === 'generate' && (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    Describe the topic you want questions for, and the system will generate MCQ and/or essay questions with marking schemes.
                  </p>
                  <textarea
                    rows={6}
                    className="input w-full min-h-[120px]"
                    placeholder={`Describe your topic in detail. For example:

"Human reproductive system - male and female anatomy, gamete production, fertilization, pregnancy, and puberty. Include both multiple choice and essay questions."

The more detail you provide, the better the generated questions will be.`}
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {generatePrompt.length} characters
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowBulkImport(false); setGeneratePrompt(''); }}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!generatePrompt.trim() || !exam) {
                            toast.error('Please enter a topic description');
                            return;
                          }
                          setGenerating(true);
                          try {
                            const res = await fetch(`/api/teacher/exams/${examId}/questions/generate`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                prompt: generatePrompt,
                                format: exam.format,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              toast.error(data.error || 'Failed to generate questions');
                              return;
                            }
                            toast.success(data.message);
                            setShowBulkImport(false);
                            setGeneratePrompt('');
                            fetchExamData();
                          } catch (error) {
                            toast.error('Failed to generate questions');
                          } finally {
                            setGenerating(false);
                          }
                        }}
                        disabled={generating || !generatePrompt.trim()}
                        className="btn btn-primary"
                      >
                        {generating ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Generating...
                          </span>
                        ) : (
                          'Generate Questions'
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center overflow-y-auto z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mt-12 mb-12">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Preview Questions ({previewQuestions.length})
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {previewMode === 'parse' ? 'Parsed from your text' : 'Generated from AI'} — Review and edit before saving.
                </p>
              </div>
              <button
                onClick={() => { setShowPreview(false); setPreviewQuestions([]); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Warnings & Errors */}
            {(previewWarnings.length > 0 || previewErrors.length > 0) && (
              <div className="px-6 py-3 border-b border-gray-200">
                {previewWarnings.map((w, i) => (
                  <p key={`w-${i}`} className="text-sm text-yellow-700 flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    {w}
                  </p>
                ))}
                {previewErrors.map((e, i) => (
                  <p key={`e-${i}`} className="text-sm text-red-600 flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {e}
                  </p>
                ))}
              </div>
            )}

            {/* Preview Questions List */}
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {previewQuestions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No questions were parsed. Try different formatting or use the Generate tab.</p>
                </div>
              ) : (
                previewQuestions.map((q, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                    {editingPreviewIndex === index ? (
                      /* Inline Edit Mode */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">Editing Q{index + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            q.type === 'mcq' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {q.type === 'mcq' ? 'MCQ' : 'Essay'}
                          </span>
                        </div>
                        <textarea
                          className="input w-full text-sm"
                          rows={2}
                          value={editQuestionText}
                          onChange={(e) => setEditQuestionText(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Points:</label>
                          <input
                            type="number"
                            min={1}
                            className="input w-20 text-sm"
                            value={editPoints}
                            onChange={(e) => setEditPoints(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        {q.type === 'mcq' && (
                          <div className="space-y-1">
                            {editOptions.map((opt: { label: string; text: string }, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 w-5">{opt.label}.</span>
                                <input
                                  type="text"
                                  className="input flex-1 text-sm"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const newOpts = [...editOptions];
                                    newOpts[oi] = { ...opt, text: e.target.value };
                                    setEditOptions(newOpts);
                                  }}
                                />
                                <button
                                  onClick={() => setEditCorrectAnswer(opt.label)}
                                  className={`px-2 py-1 rounded text-xs font-medium border ${
                                    editCorrectAnswer === opt.label
                                      ? 'bg-green-50 border-green-300 text-green-700'
                                      : 'bg-white border-gray-200 text-gray-500'
                                  }`}
                                >
                                  {editCorrectAnswer === opt.label ? '✓ Correct' : 'Correct'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === 'essay' && (
                          <textarea
                            className="input w-full text-sm"
                            rows={3}
                            placeholder="Marking scheme..."
                            value={editMarkingScheme}
                            onChange={(e) => setEditMarkingScheme(e.target.value)}
                          />
                        )}
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingPreviewIndex(null)} className="btn btn-outline text-sm">Cancel</button>
                          <button onClick={handleSaveEditPreview} className="btn btn-primary text-sm">Save</button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              q.type === 'mcq' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {q.type === 'mcq' ? 'MCQ' : 'Essay'}
                            </span>
                            <span className="text-xs text-gray-500">{q.points || 1} pt{(q.points || 1) !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-sm text-gray-900 mb-2">{q.questionText}</p>
                          {q.type === 'mcq' && q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {q.options.map((opt: { label: string; text: string }) => (
                                <div key={opt.label} className={`text-xs px-2 py-1 rounded ${
                                  opt.label === q.correctAnswer
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                                }`}>
                                  <span className="font-medium">{opt.label}.</span> {opt.text}
                                  {opt.label === q.correctAnswer && <span className="ml-1">✓</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.type === 'essay' && q.markingScheme && (
                            <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-2">
                              <p className="text-xs font-medium text-blue-700 mb-1">Marking Rubric:</p>
                              <p className="text-xs text-blue-600 whitespace-pre-wrap">{q.markingScheme}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex gap-2">
                          <button
                            onClick={() => handleEditPreviewQuestion(index)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePreviewQuestion(index)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {previewQuestions.length} question(s) ready to save
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPreview(false); setPreviewQuestions([]); }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuestions}
                  disabled={savingQuestions || previewQuestions.length === 0}
                  className="btn btn-primary"
                >
                  {savingQuestions ? 'Saving...' : `Save ${previewQuestions.length} Question(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Form Modal */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center overflow-y-auto z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mt-12 mb-12">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingQuestionId ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button
                onClick={resetQuestionForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Question Type Selector */}
              {!editingQuestionId && (
                <div>
                  <label className="label">Question Type</label>
                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setQuestionType('mcq')}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                        questionType === 'mcq'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Multiple Choice (MCQ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionType('essay')}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                        questionType === 'essay'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Essay
                    </button>
                  </div>
                </div>
              )}

              {/* Question Text */}
              <div>
                <label htmlFor="questionText" className="label">Question Text</label>
                <textarea
                  id="questionText"
                  rows={3}
                  className="input mt-1 min-h-[80px]"
                  placeholder="Enter your question here..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  maxLength={2000}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{questionText.length}/2000</p>
              </div>

              {/* Points */}
              <div>
                <label htmlFor="points" className="label">Points</label>
                <input
                  id="points"
                  type="number"
                  min={1}
                  className="input mt-1 w-32"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                />
              </div>

              {/* MCQ Options */}
              {questionType === 'mcq' && (
                <div>
                  <label className="label">Answer Options</label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">
                    Enter the options for this question. Select the correct answer below.
                  </p>
                  <div className="space-y-2">
                    {options.map((opt, index) => (
                      <div key={opt.label} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600 w-6">{opt.label}.</span>
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder={`Option ${opt.label}`}
                          value={opt.text}
                          onChange={(e) => {
                            const newOptions = [...options];
                            newOptions[index] = { ...opt, text: e.target.value };
                            setOptions(newOptions);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setCorrectAnswer(opt.label)}
                          className={`px-3 py-2 rounded text-xs font-medium border transition-colors ${
                            correctAnswer === opt.label
                              ? 'bg-green-50 border-green-300 text-green-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {correctAnswer === opt.label ? '✓ Correct' : 'Correct'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (options.length < 5) {
                        const nextLabel = String.fromCharCode(65 + options.length);
                        setOptions([...options, { label: nextLabel, text: '' }]);
                      }
                    }}
                    disabled={options.length >= 5}
                    className="text-sm text-blue-600 hover:text-blue-800 mt-2 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    + Add Option
                  </button>
                  {options.length === 5 && (
                    <p className="text-xs text-gray-400 mt-1">Maximum 5 options allowed</p>
                  )}
                </div>
              )}

              {/* Essay Marking Scheme */}
              {questionType === 'essay' && (
                <div>
                  <label htmlFor="markingScheme" className="label">Marking Rubric / Scheme</label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">
                    Define the marking criteria, point distribution, and expected key points for grading this essay.
                  </p>
                  <textarea
                    id="markingScheme"
                    rows={4}
                    className="input mt-1 min-h-[100px]"
                    placeholder="e.g.,&#10;- Correct answer with explanation: 5 pts&#10;- Partial understanding shown: 3 pts&#10;- Incorrect but attempted: 1 pt&#10;- No attempt: 0 pts"
                    value={markingScheme}
                    onChange={(e) => setMarkingScheme(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{markingScheme.length}/500</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={resetQuestionForm}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                disabled={savingQuestion}
                className="btn btn-primary"
              >
                {savingQuestion ? 'Saving...' : editingQuestionId ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}