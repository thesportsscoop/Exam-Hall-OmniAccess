'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  type: 'mcq' | 'essay';
  questionText: string;
  options: { label: string; text: string }[];
  points: number;
}

interface ExamData {
  id: string;
  title: string;
  description: string;
  format: string;
  durationMinutes: number;
  showResults: boolean;
}

interface StudentData {
  surname: string;
  firstName: string;
  className: string;
}

export default function ExamPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    // Don't submit if student data isn't loaded yet
    if (!student || !student.surname || !student.firstName) {
      toast.error('Student information not loaded. Please wait...');
      setSubmitting(false);
      return;
    }
    setSubmitting(true);

    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          surname: student.surname,
          firstName: student.firstName,
          className: student.className,
          answers: answerArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit exam');
        setSubmitting(false);
        return;
      }

      localStorage.removeItem(`exam_${examId}_answers`);
      localStorage.removeItem(`exam_${examId}_timestamp`);
      setResult(data);
    } catch (error) {
      toast.error('Failed to submit exam');
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const examData = sessionStorage.getItem('examData');
    const examQuestions = sessionStorage.getItem('examQuestions');
    const examStudent = sessionStorage.getItem('examStudent');

    if (!examData || !examQuestions || !examStudent) {
      toast.error('Please join the exam first');
      router.push('/exam/join');
      return;
    }

    setExam(JSON.parse(examData));
    setQuestions(JSON.parse(examQuestions));
    setStudent(JSON.parse(examStudent));
    setTimeLeft((JSON.parse(examData) as ExamData).durationMinutes * 60);
    setLoading(false);
  }, [examId, router]);

  useEffect(() => {
    if (!examId) return;
    const saved = localStorage.getItem(`exam_${examId}_answers`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAnswers(parsed);
      } catch (e) {
        // ignore
      }
    }
  }, [examId]);

  const saveToLocalStorage = useCallback(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`exam_${examId}_answers`, JSON.stringify(answers));
      localStorage.setItem(`exam_${examId}_timestamp`, Date.now().toString());
    }
  }, [answers, examId]);

  useEffect(() => {
    const interval = setInterval(saveToLocalStorage, 5000);
    return () => clearInterval(interval);
  }, [saveToLocalStorage]);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Only auto-submit if student data is loaded
      if (!submitting && student) handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitting, student]);

  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Submitted!</h1>
            <p className="text-gray-600">{exam?.title}</p>
          </div>

          {result.showResults ? (
            <div>
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Your Score</p>
                <p className="text-5xl font-bold text-gray-900">{result.percentage}%</p>
                <p className="text-lg text-gray-600 mt-2">{result.score} / {result.maxScore} points</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Detailed Breakdown</h3>
                {result.breakdown?.map((q: any, i: number) => (
                  <div key={q.questionId} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">Question {i + 1}</p>
                      <span className={`text-sm font-medium ${q.type === 'mcq' ? (q.isCorrect ? 'text-green-600' : 'text-red-600') : 'text-blue-600'}`}>
                        {q.pointsAwarded}/{q.maxPoints} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{q.questionText}</p>
                    {q.type === 'mcq' ? (
                      <div className="text-xs space-y-1">
                        <p className={q.isCorrect ? 'text-green-600' : 'text-red-600'}>
                          Your answer: {q.studentAnswer || '(No answer)'}
                        </p>
                        {!q.isCorrect && (
                          <p className="text-green-600">Correct answer: {q.correctAnswer}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs space-y-1">
                        <p className="text-gray-600">Your answer: {q.studentAnswer || '(No answer)'}</p>
                        {q.matchedKeywords?.length > 0 && (
                          <p className="text-green-600">Matched keywords: {q.matchedKeywords.join(', ')}</p>
                        )}
                        <p className="text-blue-600">{q.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <p className="text-blue-800">Your exam has been submitted successfully!</p>
              <p className="text-sm text-blue-600 mt-2">Results will be available later.</p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/" className="btn btn-primary">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{exam?.title}</h1>
            <p className="text-xs text-gray-500">{answeredCount}/{questions.length} answered</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-lg font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatTime(timeLeft)}
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary text-sm">
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(i)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      i === currentQuestionIndex ? 'bg-blue-600 text-white' : answers[q.id] ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-3xl">
            {questions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-500">No questions in this exam.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">{currentQuestionIndex + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase">{questions[currentQuestionIndex].type}</span>
                      <span className="text-xs text-gray-400">{questions[currentQuestionIndex].points} pts</span>
                    </div>
                    <p className="text-gray-900">{questions[currentQuestionIndex].questionText}</p>
                  </div>
                </div>

                {questions[currentQuestionIndex].type === 'mcq' && (
                  <div className="space-y-2 ml-11">
                    {questions[currentQuestionIndex].options.map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          answers[questions[currentQuestionIndex].id] === opt.label ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${questions[currentQuestionIndex].id}`}
                          value={opt.label}
                          checked={answers[questions[currentQuestionIndex].id] === opt.label}
                          onChange={(e) => handleAnswer(questions[currentQuestionIndex].id, e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{opt.label}.</span>
                        <span className="text-sm text-gray-900">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {questions[currentQuestionIndex].type === 'essay' && (
                  <div className="ml-11">
                    <textarea
                      rows={8}
                      className="input w-full"
                      placeholder="Write your answer here..."
                      value={answers[questions[currentQuestionIndex].id] || ''}
                      onChange={(e) => handleAnswer(questions[currentQuestionIndex].id, e.target.value)}
                    />
                  </div>
                )}

                <div className="flex justify-between mt-6 ml-11">
                  <button
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="btn btn-outline"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="btn btn-outline"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
