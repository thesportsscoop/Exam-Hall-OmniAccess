'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

type ImportMethod = 'paste' | 'upload' | 'manual' | 'generate';
type ParsingStage = 'idle' | 'reading' | 'cleaning' | 'detecting' | 'extracting' | 'building' | 'complete';

interface Question {
  _id?: string;
  type: 'mcq' | 'essay' | 'true_false' | 'fill_blank' | 'short_answer';
  questionText: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  markingScheme: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  section: string;
  tags: string[];
  warnings: string[];
  errors: string[];
}

interface ExamData {
  _id: string;
  title: string;
  format: string;
  isPaid: boolean;
}

export default function QuestionCreationHub() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Import method selection
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod | null>(null);
  
  // Paste method
  const [pastedText, setPastedText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsingStage, setParsingStage] = useState<ParsingStage>('idle');
  const [parsingProgress, setParsingProgress] = useState<string[]>([]);
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  
  // Upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Generate
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Manual add
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<Question['type']>('mcq');
  
  // Validation
  const [validations, setValidations] = useState<Map<number, { severity: 'error' | 'warning'; message: string }[]>>(new Map());
  const [showFinalValidation, setShowFinalValidation] = useState(false);

  // Autosave
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchExamData();
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [examId]);

  const fetchExamData = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExam(data.exam);
    } catch (error) {
      toast.error('Failed to load exam');
      router.push('/dashboard/exams');
    } finally {
      setLoading(false);
    }
  };

  const triggerAutosave = (updatedQuestions: Question[]) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/teacher/exams/${examId}/questions/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: updatedQuestions }),
        });
      } catch (error) {
        console.error('Autosave failed');
      }
    }, 3000);
  };

  const validateQuestions = (qs: Question[]): Map<number, { severity: 'error' | 'warning'; message: string }[]> => {
    const validations = new Map<number, { severity: 'error' | 'warning'; message: string }[]>();
    
    qs.forEach((q, index) => {
      const issues: { severity: 'error' | 'warning'; message: string }[] = [];
      
      if (!q.questionText.trim()) {
        issues.push({ severity: 'error', message: 'Question text is empty' });
      }
      
      if (q.type === 'mcq') {
        if (q.options.length < 4) {
          issues.push({ severity: 'warning', message: `MCQ has only ${q.options.length} options (minimum 4)` });
        }
        if (!q.correctAnswer) {
          issues.push({ severity: 'error', message: 'No correct answer selected' });
        }
      }
      
      if ((q.type === 'essay' || q.type === 'short_answer') && !q.markingScheme.trim()) {
        issues.push({ severity: 'warning', message: 'No marking rubric provided' });
      }
      
      if (!q.points || q.points < 1) {
        issues.push({ severity: 'warning', message: 'Points not specified' });
      }
      
      // Check for duplicates
      const duplicateIndex = qs.findIndex((other, i) => 
        i !== index && other.questionText === q.questionText && other.questionText.trim()
      );
      if (duplicateIndex !== -1) {
        issues.push({ severity: 'warning', message: `Duplicate of question ${duplicateIndex + 1}` });
      }
      
      if (issues.length > 0) {
        validations.set(index, issues);
      }
    });
    
    return validations;
  };

  const handlePasteAnalyze = async () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some text first');
      return;
    }

    setParsing(true);
    setParsingStage('reading');
    setParsingProgress(['Reading document...']);

    await new Promise(resolve => setTimeout(resolve, 800));
    setParsingStage('cleaning');
    setParsingProgress(['Reading document...', 'Cleaning formatting...']);

    await new Promise(resolve => setTimeout(resolve, 600));
    setParsingStage('detecting');
    setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Removing duplicated text...', 'Detecting sections...']);

    await new Promise(resolve => setTimeout(resolve, 700));
    setParsingStage('extracting');
    setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Removing duplicated text...', 'Detecting sections...', 'Finding question boundaries...', 'Detecting question types...', 'Extracting options...', 'Extracting marks...', 'Extracting answer keys...']);

    await new Promise(resolve => setTimeout(resolve, 900));
    setParsingStage('building');
    setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Removing duplicated text...', 'Detecting sections...', 'Finding question boundaries...', 'Detecting question types...', 'Extracting options...', 'Extracting marks...', 'Extracting answer keys...', 'Building examination...']);

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText }),
      });

      const data = await res.json();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setParsingStage('complete');
      setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Removing duplicated text...', 'Detecting sections...', 'Finding question boundaries...', 'Detecting question types...', 'Extracting options...', 'Extracting marks...', 'Extracting answer keys...', 'Building examination...', 'Done!']);

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse questions');
        return;
      }

      const parsedQuestions: Question[] = (data.questions || []).map((q: any) => ({
        type: q.type || 'essay',
        questionText: q.questionText || '',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        markingScheme: q.markingScheme || '',
        points: q.points || 1,
        difficulty: 'medium',
        section: '',
        tags: [],
        warnings: [],
        errors: [],
      }));

      console.log('Setting questions:', parsedQuestions.length, parsedQuestions);
      
      setQuestions(parsedQuestions);
      const validationMap = validateQuestions(parsedQuestions);
      setValidations(validationMap);
      
      // Show debug info if available
      if (data.debug) {
        console.log('Parse debug info:', data.debug);
        alert(`Debug Info:\nSections detected: ${data.debug.sectionsDetected}\nSection types: ${JSON.stringify(data.debug.sectionTypes)}\nQuality score: ${data.debug.qualityScore}\nTotal parsed: ${data.totalParsed}\nMCQs: ${data.mcqCount}\nEssays: ${data.essayCount}`);
      }
      
      toast.success(`Parsed ${parsedQuestions.length} questions successfully!`);
      
      // Immediately show questions list
      setParsingStage('idle');
      setParsingProgress([]);
      setSelectedMethod(null);
      
      // Scroll to questions list after a short delay
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 200);
    } catch (error) {
      toast.error('Failed to parse questions');
      setParsingStage('idle');
    } finally {
      setParsing(false);
    }
  };

  const handleUploadAnalyze = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a file first');
      return;
    }

    setUploading(true);
    setParsing(true);
    setParsingStage('reading');
    setParsingProgress(['Reading document...']);

    await new Promise(resolve => setTimeout(resolve, 800));
    setParsingStage('cleaning');
    setParsingProgress(['Reading document...', 'Cleaning formatting...']);

    await new Promise(resolve => setTimeout(resolve, 600));
    setParsingStage('detecting');
    setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Detecting sections...']);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('parseAfterExtract', 'true');

      const res = await fetch(`/api/teacher/exams/${examId}/questions/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      await new Promise(resolve => setTimeout(resolve, 500));
      setParsingStage('complete');
      setParsingProgress(['Reading document...', 'Cleaning formatting...', 'Detecting sections...', 'Done!']);

      if (!res.ok) {
        toast.error(data.error || 'Failed to process file');
        return;
      }

      if (data.questions && data.questions.length > 0) {
        const parsedQuestions: Question[] = data.questions.map((q: any) => ({
          type: q.type || 'essay',
          questionText: q.questionText || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          markingScheme: q.markingScheme || '',
          points: q.points || 1,
          difficulty: 'medium',
          section: '',
          tags: [],
          warnings: [],
          errors: [],
        }));
        setQuestions(parsedQuestions);
        toast.success(`Extracted and parsed ${parsedQuestions.length} questions!`);
      } else {
        toast.error('No questions found in file');
      }

      setTimeout(() => {
        setSelectedMethod(null);
        setUploading(false);
        setParsing(false);
        setParsingStage('idle');
        setParsingProgress([]);
        setUploadedFile(null);
      }, 1500);
    } catch (error) {
      toast.error('Failed to process file');
      setUploading(false);
      setParsing(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!generatePrompt.trim()) {
      toast.error('Please enter a topic description');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatePrompt, format: exam?.format }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate questions');
        return;
      }

      toast.success(data.message || 'Questions generated!');
      setGeneratePrompt('');
      setSelectedMethod(null);
      fetchExamData();
    } catch (error) {
      toast.error('Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const addManualQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      type,
      questionText: '',
      options: type === 'mcq' ? [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ] : [],
      correctAnswer: '',
      markingScheme: type === 'essay' || type === 'short_answer' ? '' : '',
      points: 1,
      difficulty: 'medium',
      section: '',
      tags: [],
      warnings: [],
      errors: [],
    };
    const updated = [...questions, newQuestion];
    setQuestions(updated);
    setEditingIndex(questions.length);
    setShowAddMenu(false);
    triggerAutosave(updated);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
    setValidations(validateQuestions(updated));
    triggerAutosave(updated);
  };

  const deleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    setValidations(validateQuestions(updated));
    triggerAutosave(updated);
    toast.success('Question removed');
  };

  const duplicateQuestion = (index: number) => {
    const original = questions[index];
    const duplicate: Question = {
      ...original,
      _id: undefined,
      questionText: original.questionText + ' (Copy)',
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, duplicate);
    setQuestions(updated);
    triggerAutosave(updated);
    toast.success('Question duplicated');
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    
    const updated = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setQuestions(updated);
    triggerAutosave(updated);
  };

  const handleSaveAll = async () => {
    console.log('Save button clicked, questions count:', questions.length);
    
    if (questions.length === 0) {
      toast.error('No questions to save');
      return;
    }

    const validationMap = validateQuestions(questions);
    const errors = Array.from(validationMap.values()).flat().filter(v => v.severity === 'error');
    
    console.log('Validation errors:', errors);
    
    if (errors.length > 0) {
      toast.error(`Please fix ${errors.length} error(s) before saving`);
      setShowFinalValidation(true);
      return;
    }

    setSaving(true);
    try {
      console.log('Saving questions:', questions);
      
      const res = await fetch(`/api/teacher/exams/${examId}/questions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });

      const data = await res.json();
      console.log('Save response:', { status: res.status, data });
      
      if (!res.ok) {
        toast.error(data.error || 'Failed to save questions');
        console.error('Save failed:', data);
        return;
      }

      toast.success(`Saved ${questions.length} questions successfully!`);
      router.push(`/dashboard/exams/${examId}`);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}`)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Creation Hub</h1>
            <p className="text-gray-600 mt-1">Choose how you'd like to create your exam questions</p>
          </div>
        </div>
      </div>

      {/* Method Selection */}
      {!selectedMethod && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => setSelectedMethod('paste')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 text-center hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Paste Questions</h3>
            <p className="text-sm text-gray-500">Paste text from Word, PDF, or any source</p>
          </button>

          <button
            onClick={() => setSelectedMethod('upload')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 text-center hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Document</h3>
            <p className="text-sm text-gray-500">Upload PDF, DOCX, or image files</p>
          </button>

          <button
            onClick={() => setSelectedMethod('manual')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 text-center hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Build Manually</h3>
            <p className="text-sm text-gray-500">Create questions from scratch</p>
          </button>

          <button
            onClick={() => setSelectedMethod('generate')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-8 text-center hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate with AI</h3>
            <p className="text-sm text-gray-500">Let AI create questions from a topic</p>
          </button>
        </div>
      )}

      {/* Method Content */}
      {selectedMethod && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedMethod === 'paste' && 'Paste Questions'}
              {selectedMethod === 'upload' && 'Upload Document'}
              {selectedMethod === 'manual' && 'Build Manually'}
              {selectedMethod === 'generate' && 'Generate with AI'}
            </h2>
            <button
              onClick={() => {
                setSelectedMethod(null);
                setPastedText('');
                setUploadedFile(null);
                setGeneratePrompt('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Paste Method */}
          {selectedMethod === 'paste' && !parsing && (
            <div>
              <textarea
                rows={16}
                className="input w-full min-h-[400px] font-mono text-sm"
                placeholder="Paste your questions here in any format...

Example:
1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid

2. Explain the process of photosynthesis.
(10 marks)"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-500">
                    {pastedText.split('\n').filter(l => l.trim()).length} lines · {pastedText.length} characters
                  </p>
                  <div className="flex gap-2">
                    {['MCQ', 'Essay', 'True/False', 'Fill Blank'].map(type => (
                      <label key={type} className="flex items-center gap-1 text-xs text-gray-600">
                        <input type="checkbox" defaultChecked className="w-3 h-3" />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handlePasteAnalyze}
                  disabled={!pastedText.trim()}
                  className="btn btn-primary"
                >
                  Analyze Questions
                </button>
              </div>
            </div>
          )}

          {/* Upload Method */}
          {selectedMethod === 'upload' && !uploading && (
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                {!uploadedFile ? (
                  <>
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-medium text-gray-700 mb-2">Drag and drop your file here</p>
                    <p className="text-sm text-gray-500 mb-4">Supports PDF, DOCX, TXT, PNG, JPG</p>
                    <label className="btn btn-outline cursor-pointer">
                      Browse Files
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadedFile(file);
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <div>
                    <svg className="w-12 h-12 text-blue-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-1">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500 mb-4">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => setUploadedFile(null)} className="btn btn-outline">Remove</button>
                      <button onClick={handleUploadAnalyze} className="btn btn-primary">Extract & Parse with AI</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Method */}
          {selectedMethod === 'manual' && (
            <div>
              <div className="text-center py-8">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="btn btn-primary text-lg px-8 py-3"
                >
                  + Add Question
                </button>
              </div>

              {showAddMenu && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { type: 'mcq', label: 'Multiple Choice', icon: '☑' },
                    { type: 'essay', label: 'Essay', icon: '📝' },
                    { type: 'true_false', label: 'True/False', icon: '✓' },
                    { type: 'fill_blank', label: 'Fill Blank', icon: '____' },
                    { type: 'short_answer', label: 'Short Answer', icon: '📄' },
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => addManualQuestion(item.type as Question['type'])}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate Method */}
          {selectedMethod === 'generate' && (
            <div>
              <textarea
                rows={8}
                className="input w-full min-h-[150px]"
                placeholder="Describe your topic in detail. For example:

Human reproductive system - male and female anatomy, gamete production, fertilization, pregnancy, and puberty. Include both multiple choice and essay questions.

The more detail you provide, the better the generated questions will be."
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">{generatePrompt.length} characters</p>
                <button
                  onClick={handleGenerateQuestions}
                  disabled={generating || !generatePrompt.trim()}
                  className="btn btn-primary"
                >
                  {generating ? 'Generating...' : 'Generate Questions'}
                </button>
              </div>
            </div>
          )}

          {/* Parsing Progress */}
          {(parsing || uploading) && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900">AI is analyzing your questions...</h3>
              </div>
              <div className="space-y-2">
                {parsingProgress.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="mt-8">
          {/* Summary Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-500">Total Questions</p>
                  <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Points</p>
                  <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">MCQs</p>
                  <p className="text-2xl font-bold text-gray-900">{questions.filter(q => q.type === 'mcq').length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Essays</p>
                  <p className="text-2xl font-bold text-gray-900">{questions.filter(q => q.type === 'essay').length}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMethod('manual')}
                  className="btn btn-outline"
                >
                  + Add Question
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save All Questions'}
                </button>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((question, index) => {
              const questionValidations = validations.get(index) || [];
              
              return (
                <div
                  key={index}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                    questionValidations.some(v => v.severity === 'error') ? 'border-red-300' : 'border-gray-200'
                  }`}
                >
                  {editingIndex === index ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Editing Question {index + 1}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingIndex(null)} className="btn btn-outline text-sm">Cancel</button>
                          <button onClick={() => setEditingIndex(null)} className="btn btn-primary text-sm">Save</button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="label">Question Type</label>
                        <select
                          className="input mt-1"
                          value={question.type}
                          onChange={(e) => updateQuestion(index, { type: e.target.value as Question['type'] })}
                        >
                          <option value="mcq">Multiple Choice</option>
                          <option value="essay">Essay</option>
                          <option value="true_false">True/False</option>
                          <option value="fill_blank">Fill in the Blank</option>
                          <option value="short_answer">Short Answer</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Question Text</label>
                        <textarea
                          className="input mt-1"
                          rows={3}
                          value={question.questionText}
                          onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
                        />
                      </div>

                      {question.type === 'mcq' && (
                        <div className="space-y-2">
                          <label className="label">Options</label>
                          {question.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-600 w-8">{opt.label}.</span>
                              <input
                                type="text"
                                className="input flex-1"
                                value={opt.text}
                                onChange={(e) => {
                                  const newOpts = [...question.options];
                                  newOpts[oi] = { ...opt, text: e.target.value };
                                  updateQuestion(index, { options: newOpts });
                                }}
                              />
                              <button
                                onClick={() => updateQuestion(index, { correctAnswer: opt.label })}
                                className={`px-3 py-2 rounded text-xs font-medium border ${
                                  question.correctAnswer === opt.label
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-white border-gray-200 text-gray-500'
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
                          <label className="label">Marking Rubric</label>
                          <textarea
                            className="input mt-1"
                            rows={4}
                            value={question.markingScheme}
                            onChange={(e) => updateQuestion(index, { markingScheme: e.target.value })}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Points</label>
                          <input
                            type="number"
                            className="input mt-1"
                            min={1}
                            value={question.points}
                            onChange={(e) => updateQuestion(index, { points: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <label className="label">Difficulty</label>
                          <select
                            className="input mt-1"
                            value={question.difficulty}
                            onChange={(e) => updateQuestion(index, { difficulty: e.target.value as Question['difficulty'] })}
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-700">{index + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                question.type === 'mcq' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {question.type.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">{question.points} pts</span>
                              <span className="text-xs text-gray-500">• {question.difficulty}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => moveQuestion(index, 'up')} className="text-gray-400 hover:text-gray-600" title="Move up">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button onClick={() => moveQuestion(index, 'down')} className="text-gray-400 hover:text-gray-600" title="Move down">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button onClick={() => duplicateQuestion(index)} className="text-gray-400 hover:text-blue-600" title="Duplicate">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingIndex(index)} className="text-gray-400 hover:text-blue-600" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => deleteQuestion(index)} className="text-gray-400 hover:text-red-600" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <p className="text-gray-900 mb-3">{question.questionText || 'No question text'}</p>

                      {question.type === 'mcq' && question.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {question.options.map(opt => (
                            <div key={opt.label} className={`text-sm px-3 py-2 rounded ${
                              opt.label === question.correctAnswer
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                            }`}>
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

                      {/* Validation Warnings */}
                      {questionValidations.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {questionValidations.map((v, vi) => (
                            <div key={vi} className={`text-xs flex items-center gap-2 ${
                              v.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                            }`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              {v.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final Actions */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setSelectedMethod('manual')}
              className="btn btn-outline"
            >
              + Add More Questions
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/dashboard/exams/${examId}`)}
                className="btn btn-outline"
              >
                Save as Draft
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Publish Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {questions.length === 0 && !selectedMethod && (
        <div className="text-center py-16">
          <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No questions yet</h3>
          <p className="text-gray-500 mb-6">Select a method above to start creating your exam questions</p>
        </div>
      )}
    </div>
  );
}