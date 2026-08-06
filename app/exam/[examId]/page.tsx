'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  type: 'mcq' | 'essay' | 'true_false' | 'fill_blank' | 'short_answer';
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
  classes: string[];
  availabilityType: string;
  lateSubmissionPolicy: string;
  maxAttempts: number;
  oneDeviceOnly: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  shuffleStudents: boolean;
  showTimer: boolean;
  autoSubmit: boolean;
  preventCopyPaste: boolean;
  requireFullscreen: boolean;
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  hideResults: boolean;
  releaseResultsLater: boolean;
  releaseDate: string | null;
  certificateAfterCompletion: boolean;
  startTime: string;
  endTime: string;
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
  const [attemptError, setAttemptError] = useState<string | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const processedQuestions = useMemo(() => {
    if (!questions.length) return [];
    let qs = [...questions];
    if (exam?.randomizeQuestions) {
      qs = shuffleArray(qs);
    }
    if (exam?.randomizeOptions) {
      qs = qs.map(q => {
        if (q.type === 'mcq' && q.options.length > 0) {
          const shuffledOpts = shuffleArray(q.options);
          return { ...q, options: shuffledOpts };
        }
        return q;
      });
    }
    return qs;
  }, [questions, exam?.randomizeQuestions, exam?.randomizeOptions]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!student || !student.surname || !student.firstName) {
      toast.error('Student information not loaded. Please wait...');
      return;
    }

    const isLate = new Date() > new Date(exam!.endTime);
    if (isLate && exam?.lateSubmissionPolicy === 'reject') {
      toast.error('Late submissions are not accepted for this exam.');
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

    const parsedExam = JSON.parse(examData) as ExamData;
    const parsedQuestions = JSON.parse(examQuestions);
    const parsedStudent = JSON.parse(examStudent);

    if (parsedExam.hideResults) {
      parsedExam.showResults = false;
    } else if (parsedExam.showScoreImmediately) {
      parsedExam.showResults = true;
    }

    setExam(parsedExam);
    setQuestions(parsedQuestions);
    setStudent(parsedStudent);
    setTimeLeft(parsedExam.durationMinutes * 60);
    setLoading(false);

    if (parsedExam.maxAttempts && parsedExam.maxAttempts <= 0) {
      setAttemptError('You have already used all allowed attempts for this exam.');
      return;
    }

    if (parsedExam.requireFullscreen) {
      const goFullscreen = async () => {
        try {
          await document.documentElement.requestFullscreen();
        } catch (e) {
          console.warn('Fullscreen not supported or blocked');
        }
      };
      goFullscreen();
    }
  }, [examId, router]);

  useEffect(() => {
    if (!examId || !exam) return;
    const saved = localStorage.getItem(`exam_${examId}_answers`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAnswers(parsed);
      } catch (e) {
        // ignore
      }
    }
  }, [examId, exam]);

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
    if (!exam?.showTimer) return;
    if (timeLeft <= 0) {
      if (!submitting && student) {
        if (exam.autoSubmit) {
          handleSubmit();
        } else {
          toast.error('Time is up!');
        }
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitting, student, exam?.showTimer, exam?.autoSubmit]);

  useEffect(() => {
    if (!exam?.preventCopyPaste) return;

    const prevent = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key)) {
        e.preventDefault();
      }
    };

    document.addEventListener('paste', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('keydown', preventKeys);

    return () => {
      document.removeEventListener('paste', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('keydown', preventKeys);
    };
  }, [exam?.preventCopyPaste]);

  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (attemptError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">{attemptError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const isLate = new Date() > new Date(exam!.endTime);

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
            {isLate && exam?.lateSubmissionPolicy === 'accept_penalty' && (
              <p className="text-sm text-yellow-600 mt-2">Late submission - penalty may apply</p>
            )}
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
                      <span className={`text-sm font-medium ${q.type === 'mcq' || q.type === 'true_false' || q.type === 'fill_blank' ? (q.isCorrect ? 'text-green-600' : 'text-red-600') : 'text-blue-600'}`}>
                        {q.pointsAwarded}/{q.maxPoints} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{q.questionText}</p>
                    {q.type === 'mcq' || q.type === 'true_false' || q.type === 'fill_blank' ? (
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
                        {q.matchedKeywords?.length > 0 && exam?.showCorrectAnswers && (
                          <p className="text-green-600">Matched keywords: {q.matchedKeywords.join(', ')}</p>
                        )}
                        {exam?.showExplanations && (
                          <p className="text-blue-600">{q.feedback}</p>
                        )}
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

  const currentQuestion = processedQuestions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{exam?.title}</h1>
            <p className="text-xs text-gray-500">{answeredCount}/{questions.length} answered</p>
          </div>
          <div className="flex items-center gap-4">
            {exam?.showTimer && (
              <div className={`text-lg font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatTime(timeLeft)}
              </div>
            )}
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
                {processedQuestions.map((q, i) => (
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
                      <span className="text-xs font-medium text-gray-500 uppercase">{currentQuestion.type}</span>
                      <span className="text-xs text-gray-400">{currentQuestion.points} pts</span>
                    </div>
                    <p className="text-gray-900">{currentQuestion.questionText}</p>
                  </div>
                </div>

                {currentQuestion.type === 'mcq' && (
                  <div className="space-y-2 ml-11">
                    {currentQuestion.options.map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          answers[currentQuestion.id] === opt.label ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQuestion.id}`}
                          value={opt.label}
                          checked={answers[currentQuestion.id] === opt.label}
                          onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{opt.label}.</span>
                        <span className="text-sm text-gray-900">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'true_false' && (
                  <div className="space-y-2 ml-11">
                    {['True', 'False'].map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          answers[currentQuestion.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQuestion.id}`}
                          value={opt}
                          checked={answers[currentQuestion.id] === opt}
                          onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'fill_blank' && (
                  <div className="ml-11">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Type your answer here..."
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    />
                  </div>
                )}

                {(currentQuestion.type === 'essay' || currentQuestion.type === 'short_answer') && (
                  <div className="ml-11">
                    <textarea
                      rows={currentQuestion.type === 'short_answer' ? 4 : 8}
                      className="input w-full"
                      placeholder={currentQuestion.type === 'short_answer' ? 'Type a brief answer here...' : 'Write your answer here...'}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
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
                    onClick={() => setCurrentQuestionIndex(Math.min(processedQuestions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === processedQuestions.length - 1}
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