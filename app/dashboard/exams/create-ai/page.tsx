'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Question {
  _id?: string;
  type: 'mcq' | 'essay' | 'true_false' | 'fill_blank' | 'matching' | 'calculation' | 'practical' | 'diagram' | 'short_answer';
  questionText: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  markingScheme: string;
  points: number;
  confidence: number;
  warnings: string[];
  errors: string[];
  questionNumber?: number;
}

interface ExamMetadata {
  title: string;
  subject: string;
  className: string;
  duration: number;
  instructions: string[];
}

interface ParsedExam {
  metadata: ExamMetadata;
  questions: Question[];
  sections: any[];
  summary: {
    totalQuestions: number;
    totalMarks: number;
    mcqCount: number;
    essayCount: number;
    otherCount: number;
    overallConfidence: number;
  };
  validation: {
    valid: boolean;
    warnings: string[];
    errors: string[];
    lowConfidenceQuestions: Question[];
  };
}

type AppStep = 'input' | 'preview' | 'review' | 'validate' | 'save';

export default function CreateExamAIPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<AppStep>('input');
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedExam, setParsedExam] = useState<ParsedExam | null>(null);
  const [editingQuestions, setEditingQuestions] = useState<Question[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [lineCount, setLineCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setLineCount(rawText.split('\n').filter(l => l.trim()).length);
    setCharCount(rawText.length);
  }, [rawText]);

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Please paste some text first');
      return;
    }

    setParsing(true);
    try {
      const res = await fetch('/api/teacher/exams/placeholder/questions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse questions');
        return;
      }

      const examData: ParsedExam = {
        metadata: data.metadata || {
          title: examTitle || 'Untitled Exam',
          subject: '',
          className: '',
          duration: examDuration,
          instructions: [],
        },
        questions: data.questions || [],
        sections: data.sections || [],
        summary: data.summary || {
          totalQuestions: 0,
          totalMarks: 0,
          mcqCount: 0,
          essayCount: 0,
          otherCount: 0,
          overallConfidence: 0,
        },
        validation: data.validation || {
          valid: true,
          warnings: [],
          errors: [],
          lowConfidenceQuestions: [],
        },
      };

      setParsedExam(examData);
      setEditingQuestions([...examData.questions]);
      setCurrentStep('preview');
      
      if (examData.summary.totalQuestions > 0) {
        toast.success(`Parsed ${examData.summary.totalQuestions} questions successfully!`);
      } else {
        toast.error('No questions detected. Please check your text.');
      }
    } catch (error) {
      toast.error('Failed to parse questions');
      console.error('Parse error:', error);
    } finally {
      setParsing(false);
    }
  };

  const handleEditQuestion = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const updated = [...editingQuestions];
    updated[editingIndex] = { ...updated[editingIndex] };
    setEditingQuestions(updated);
    setEditingIndex(null);
    toast.success('Question updated');
  };

  const handleDeleteQuestion = (index: number) => {
    const updated = editingQuestions.filter((_, i) => i !== index);
    setEditingQuestions(updated);
    toast.success('Question removed');
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      type: 'essay',
      questionText: '',
      options: [],
      correctAnswer: '',
      markingScheme: '',
      points: 1,
      confidence: 100,
      warnings: [],
      errors: [],
    };
    setEditingQuestions([...editingQuestions, newQuestion]);
    setEditingIndex(editingQuestions.length);
  };

  const handleValidate = () => {
    if (editingQuestions.length === 0) {
      toast.error('No questions to validate');
      return;
    }
    setCurrentStep('validate');
  };

  const handleSaveExam = async () => {
    if (!examTitle.trim()) {
      toast.error('Please enter an exam title');
      return;
    }

    setSaving(true);
    try {
      // First create the exam
      const examRes = await fetch('/api/teacher/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: examTitle,
          description: `Exam with ${editingQuestions.length} questions`,
          durationMinutes: examDuration,
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 2 * 86400000).toISOString(),
          passkey: generatePasskey(),
          format: 'hybrid',
          classes: [],
          isPaid: false,
        }),
      });

      const examData = await examRes.json();

      if (!examRes.ok) {
        toast.error(examData.error || 'Failed to create exam');
        return;
      }

      const examId = examData.exam._id;

      // Save questions
      const saveRes = await fetch(`/api/teacher/exams/${examId}/questions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: editingQuestions }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        toast.error(saveData.error || 'Failed to save questions');
        return;
      }

      toast.success('Exam created successfully!');
      router.push(`/dashboard/exams/${examId}`);
    } catch (error) {
      toast.error('Failed to save exam');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const generatePasskey = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const renderInputStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Exam with AI</h1>
        <p className="text-gray-600 mt-2">
          Paste your examination questions in any format. The AI will automatically detect and structure them.
        </p>
      </div>

      {/* Exam Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="title" className="label">Exam Title *</label>
            <input
              id="title"
              type="text"
              required
              className="input mt-1"
              placeholder="e.g., Mathematics Mid-Term Exam"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="duration" className="label">Duration (minutes)</label>
            <input
              id="duration"
              type="number"
              min={1}
              max={480}
              className="input mt-1"
              value={examDuration}
              onChange={(e) => setExamDuration(parseInt(e.target.value) || 60)}
            />
          </div>
        </div>
      </div>

      {/* Text Input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Paste Questions</h2>
          <div className="text-sm text-gray-500">
            {lineCount} lines · {charCount} characters
          </div>
        </div>
        
        <textarea
          rows={16}
          className="input w-full min-h-[400px] font-mono text-sm"
          placeholder={`Paste your questions here in any format:

Example 1 - Natural Language:
1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid

2. Explain the process of photosynthesis.
(10 marks)

Example 2 - Section Format:
Section A: Multiple Choice Questions (20 Marks)
1. Which organ pumps blood?
A) Heart
B) Liver
C) Kidney
D) Lung
Answer: A

Section B: Essay Questions (30 Marks)
1. Discuss the causes of climate change.
Marking Scheme:
- Greenhouse gases: 10 marks
- Deforestation: 10 marks
- Industrialization: 10 marks`}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Supports: PDF text, Word docs, OCR output, WhatsApp messages, emails, websites
          </p>
          <button
            onClick={handleParse}
            disabled={parsing || !rawText.trim()}
            className="btn btn-primary"
          >
            {parsing ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Parsing...
              </span>
            ) : (
              'Parse Questions'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (!parsedExam) return null;

    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Preview Parsed Questions</h1>
          <p className="text-gray-600 mt-2">
            {parsedExam.summary.totalQuestions} questions found · {parsedExam.summary.totalMarks} total marks
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">MCQ</p>
            <p className="text-2xl font-bold text-gray-900">{parsedExam.summary.mcqCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Essay</p>
            <p className="text-2xl font-bold text-gray-900">{parsedExam.summary.essayCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Other Types</p>
            <p className="text-2xl font-bold text-gray-900">{parsedExam.summary.otherCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Confidence</p>
            <p className="text-2xl font-bold text-gray-900">{parsedExam.summary.overallConfidence}%</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => setCurrentStep('input')} className="btn btn-outline">
            ← Back to Input
          </button>
          <button onClick={handleAddQuestion} className="btn btn-outline">
            + Add Question
          </button>
          <button onClick={handleValidate} className="btn btn-primary">
            Review & Validate →
          </button>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {editingQuestions.map((question, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {editingIndex === index ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Edit Question {index + 1}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingIndex(null)} className="btn btn-outline text-sm">Cancel</button>
                      <button onClick={handleSaveEdit} className="btn btn-primary text-sm">Save</button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Question Text</label>
                    <textarea
                      className="input mt-1"
                      rows={3}
                      value={question.questionText}
                      onChange={(e) => {
                        const updated = [...editingQuestions];
                        updated[index] = { ...updated[index], questionText: e.target.value };
                        setEditingQuestions(updated);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Type</label>
                      <select
                        className="input mt-1"
                        value={question.type}
                        onChange={(e) => {
                          const updated = [...editingQuestions];
                          updated[index] = { ...updated[index], type: e.target.value as Question['type'] };
                          setEditingQuestions(updated);
                        }}
                      >
                        <option value="mcq">MCQ</option>
                        <option value="essay">Essay</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="calculation">Calculation</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Points</label>
                      <input
                        type="number"
                        className="input mt-1"
                        value={question.points}
                        onChange={(e) => {
                          const updated = [...editingQuestions];
                          updated[index] = { ...updated[index], points: parseInt(e.target.value) || 1 };
                          setEditingQuestions(updated);
                        }}
                      />
                    </div>
                  </div>

                  {question.type === 'mcq' && (
                    <div>
                      <label className="label">Options</label>
                      {question.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2 mt-2">
                          <span className="text-sm font-medium text-gray-600 w-6">{opt.label}.</span>
                          <input
                            type="text"
                            className="input flex-1"
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...editingQuestions];
                              const newOptions = [...updated[index].options];
                              newOptions[optIndex] = { ...newOptions[optIndex], text: e.target.value };
                              updated[index] = { ...updated[index], options: newOptions };
                              setEditingQuestions(updated);
                            }}
                          />
                          <button
                            onClick={() => {
                              const updated = [...editingQuestions];
                              updated[index] = { ...updated[index], correctAnswer: opt.label };
                              setEditingQuestions(updated);
                            }}
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              question.correctAnswer === opt.label
                                ? 'bg-green-50 text-green-700 border border-green-300'
                                : 'bg-white border border-gray-200 text-gray-600'
                            }`}
                          >
                            {question.correctAnswer === opt.label ? '✓ Correct' : 'Correct'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(question.type === 'essay' || question.type === 'short_answer') && (
                    <div>
                      <label className="label">Marking Scheme</label>
                      <textarea
                        className="input mt-1"
                        rows={4}
                        value={question.markingScheme}
                        onChange={(e) => {
                          const updated = [...editingQuestions];
                          updated[index] = { ...updated[index], markingScheme: e.target.value };
                          setEditingQuestions(updated);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        question.type === 'mcq' ? 'bg-purple-100 text-purple-800' :
                        question.type === 'essay' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {question.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{question.points} pts</span>
                      {question.confidence < 70 && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                          Low confidence
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditQuestion(index)} className="text-gray-400 hover:text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteQuestion(index)} className="text-gray-400 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-900 mb-3">{question.questionText}</p>

                  {question.type === 'mcq' && question.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {question.options.map((opt) => (
                        <div
                          key={opt.label}
                          className={`text-sm px-3 py-2 rounded ${
                            opt.label === question.correctAnswer
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          <span className="font-medium">{opt.label}.</span> {opt.text}
                          {opt.label === question.correctAnswer && <span className="ml-2">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {(question.type === 'essay' || question.type === 'short_answer') && question.markingScheme && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">Marking Rubric:</p>
                      <p className="text-xs text-blue-600 whitespace-pre-wrap">{question.markingScheme}</p>
                    </div>
                  )}

                  {question.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                      {question.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderValidateStep = () => {
    if (!parsedExam) return null;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Review & Validate</h1>
          <p className="text-gray-600 mt-2">
            Review the validation results before saving your exam.
          </p>
        </div>

        {/* Validation Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Summary</h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                parsedExam.validation.valid ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${parsedExam.validation.valid ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {parsedExam.validation.valid ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {parsedExam.validation.valid ? 'Validation Passed' : 'Validation Failed'}
                </p>
                <p className="text-sm text-gray-500">
                  {editingQuestions.length} questions · {parsedExam.summary.totalMarks} total marks
                </p>
              </div>
            </div>

            {parsedExam.validation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Warnings ({parsedExam.validation.warnings.length})</h3>
                <ul className="space-y-1">
                  {parsedExam.validation.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-yellow-700">⚠ {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedExam.validation.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">Errors ({parsedExam.validation.errors.length})</h3>
                <ul className="space-y-1">
                  {parsedExam.validation.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-700">✕ {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedExam.validation.lowConfidenceQuestions.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  Low Confidence Questions ({parsedExam.validation.lowConfidenceQuestions.length})
                </h3>
                <p className="text-sm text-blue-700">
                  These questions may need manual review before saving.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => setCurrentStep('preview')} className="btn btn-outline">
            ← Back to Preview
          </button>
          <button
            onClick={handleSaveExam}
            disabled={saving || !parsedExam.validation.valid}
            className="btn btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </span>
            ) : (
              'Save Exam'
            )}
          </button>
        </div>
      </div>
    );
  };

  const steps = [
    { id: 'input', label: 'Input', description: 'Paste questions' },
    { id: 'preview', label: 'Preview', description: 'Review questions' },
    { id: 'validate', label: 'Validate', description: 'Check quality' },
    { id: 'save', label: 'Save', description: 'Create exam' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI-Powered Exam Creation</h1>
        <p className="text-gray-600 mt-2">
          Create examinations manually or by pasting unstructured text from any source.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                index <= currentStepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {index + 1}
              </div>
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-gray-900">{step.label}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${
                index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 'input' && renderInputStep()}
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'validate' && renderValidateStep()}
    </div>
  );
}