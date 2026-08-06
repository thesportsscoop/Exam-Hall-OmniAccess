'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface ExamFormData {
  // Step 1: Exam Details
  title: string;
  description: string;
  subject: string;
  classes: string;
  academicYear: string;
  term: string;
  department: string;
  examType: string;
  
  // Step 2: Availability
  availabilityType: 'anytime' | 'scheduled';
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  lateSubmissionPolicy: string;
  
  // Step 3: Access & Security
  passkey: string;
  customPasskey: string;
  maxAttempts: number;
  oneDeviceOnly: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  shuffleStudents: boolean;
  showTimer: boolean;
  autoSubmit: boolean;
  preventCopyPaste: boolean;
  requireFullscreen: boolean;
  
  // Step 4: Results
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  hideResults: boolean;
  releaseResultsLater: boolean;
  releaseDate: string;
  certificateAfterCompletion: boolean;
  
  // Step 5: Payment
  numberOfCandidates: number;
  price: number;
  
  // Step 6: Questions
  questions: any[];
}

export default function CreateExamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [examCreated, setExamCreated] = useState(false);
  const [createdExamId, setCreatedExamId] = useState('');
  
  const [formData, setFormData] = useState<ExamFormData>({
    title: '',
    description: '',
    subject: '',
    classes: '',
    academicYear: new Date().getFullYear().toString(),
    term: 'First',
    department: '',
    examType: 'mcq',
    availabilityType: 'anytime',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    durationMinutes: 60,
    timezone: 'UTC',
    lateSubmissionPolicy: 'reject',
    passkey: '',
    customPasskey: '',
    maxAttempts: 1,
    oneDeviceOnly: false,
    randomizeQuestions: false,
    randomizeOptions: false,
    shuffleStudents: false,
    showTimer: true,
    autoSubmit: true,
    preventCopyPaste: true,
    requireFullscreen: true,
    showScoreImmediately: false,
    showCorrectAnswers: false,
    showExplanations: false,
    hideResults: true,
    releaseResultsLater: false,
    releaseDate: '',
    certificateAfterCompletion: false,
    numberOfCandidates: 1,
    price: 100,
    questions: [],
  });

  // Check for payment callback
  useEffect(() => {
    const status = searchParams.get('payment_status');
    const ref = searchParams.get('reference');
    if (status === 'completed' && ref) {
      verifyPayment(ref);
    }
  }, [searchParams]);

  const verifyPayment = async (reference: string) => {
    try {
      const res = await fetch(`/api/payment/verify?reference=${reference}`);
      const data = await res.json();
      if (data.verified) {
        setPaymentCompleted(true);
        toast.success('Payment verified successfully!');
      } else {
        toast.error(data.error || 'Payment verification failed');
      }
    } catch (error) {
      toast.error('Failed to verify payment');
    }
  };

  const calculatePrice = (candidates: number): number => {
    if (candidates <= 120) {
      return 100;
    }
    return 100 + (candidates - 120) * 1;
  };

  const updateFormData = (updates: Partial<ExamFormData>) => {
    const newData = { ...formData, ...updates };
    if (updates.numberOfCandidates !== undefined) {
      newData.price = calculatePrice(updates.numberOfCandidates);
    }
    setFormData(newData);
  };

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handlePayment = async () => {
    if (!formData.title) {
      toast.error('Please enter exam title');
      return;
    }

    setLoading(true);
    setPaymentLoading(true);

    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.user) {
        toast.error('Please login again');
        router.push('/login');
        return;
      }

      const payRes = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: meData.user.email,
          amount: formData.price,
          metadata: {
            examTitle: formData.title,
            numberOfCandidates: formData.numberOfCandidates,
          },
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        toast.error(payData.error || 'Payment initialization failed');
        setLoading(false);
        setPaymentLoading(false);
        return;
      }

      sessionStorage.setItem('pendingExam', JSON.stringify(formData));
      window.location.href = payData.authorizationUrl;
    } catch (error) {
      toast.error('Something went wrong');
      setLoading(false);
      setPaymentLoading(false);
    }
  };

  // After payment, create exam
  useEffect(() => {
    if (paymentCompleted) {
      const savedData = sessionStorage.getItem('pendingExam');
      if (savedData) {
        createExam(JSON.parse(savedData));
        sessionStorage.removeItem('pendingExam');
      }
    }
  }, [paymentCompleted]);

  const createExam = async (data: ExamFormData) => {
    try {
      const startDateTime = data.availabilityType === 'scheduled' 
        ? new Date(`${data.startDate}T${data.startTime}`)
        : new Date();
      const endDateTime = data.availabilityType === 'scheduled'
        ? new Date(`${data.endDate}T${data.endTime}`)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const res = await fetch('/api/teacher/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          subject: data.subject,
          academicYear: data.academicYear,
          term: data.term,
          department: data.department,
          durationMinutes: data.durationMinutes,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          timezone: data.timezone,
          passkey: data.customPasskey || data.passkey,
          format: data.examType,
          classes: data.classes ? data.classes.split(',').map((c) => c.trim()).filter(Boolean) : [],
          isPaid: true,
          availabilityType: data.availabilityType,
          lateSubmissionPolicy: data.lateSubmissionPolicy,
          maxAttempts: data.maxAttempts,
          oneDeviceOnly: data.oneDeviceOnly,
          randomizeQuestions: data.randomizeQuestions,
          randomizeOptions: data.randomizeOptions,
          shuffleStudents: data.shuffleStudents,
          showTimer: data.showTimer,
          autoSubmit: data.autoSubmit,
          preventCopyPaste: data.preventCopyPaste,
          requireFullscreen: data.requireFullscreen,
          showScoreImmediately: data.showScoreImmediately,
          showCorrectAnswers: data.showCorrectAnswers,
          showExplanations: data.showExplanations,
          hideResults: data.hideResults,
          releaseResultsLater: data.releaseResultsLater,
          releaseDate: data.releaseDate,
          certificateAfterCompletion: data.certificateAfterCompletion,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to create exam');
        setLoading(false);
        setPaymentLoading(false);
        return;
      }

      setExamCreated(true);
      setCreatedExamId(result.exam._id);
      toast.success('Exam created successfully!');
      setLoading(false);
      setPaymentLoading(false);
    } catch (error) {
      toast.error('Failed to create exam');
      setLoading(false);
      setPaymentLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Exam Details', icon: '📝' },
    { id: 2, label: 'Availability', icon: '📅' },
    { id: 3, label: 'Access & Security', icon: '🔒' },
    { id: 4, label: 'Results', icon: '📊' },
    { id: 5, label: 'Payment', icon: '💳' },
    { id: 6, label: 'Questions', icon: '❓' },
  ];

  if (examCreated) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Created Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Payment has been completed. You can now add questions to your exam.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push(`/dashboard/exams/${createdExamId}`)}
              className="btn btn-primary"
            >
              Add Questions
            </button>
            <button
              onClick={() => router.push('/dashboard/exams')}
              className="btn btn-outline"
            >
              Back to Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting to Payment</h2>
          <p className="text-gray-600">Please complete the payment to create your exam.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Examination</h1>
        <p className="text-gray-600 mt-1">Follow the steps below to create your exam</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > step.id ? '✓' : step.icon}
                </div>
                <p className="text-xs mt-1 text-center font-medium text-gray-700">{step.label}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {/* Step 1: Exam Details */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 1: Exam Details</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Exam Title *</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="e.g., Mathematics Mid-Term Exam"
                  value={formData.title}
                  onChange={(e) => updateFormData({ title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input mt-1"
                  rows={3}
                  placeholder="Optional description for students"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Subject *</label>
                  <input
                    type="text"
                    className="input mt-1"
                    placeholder="e.g., Mathematics"
                    value={formData.subject}
                    onChange={(e) => updateFormData({ subject: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Exam Type *</label>
                  <select
                    className="input mt-1"
                    value={formData.examType}
                    onChange={(e) => updateFormData({ examType: e.target.value })}
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="essay">Essay</option>
                    <option value="hybrid">Hybrid (MCQ + Essay)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Class(es) (comma separated)</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="e.g., SHS 2A, SHS 2B"
                  value={formData.classes}
                  onChange={(e) => updateFormData({ classes: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Academic Year</label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={formData.academicYear}
                    onChange={(e) => updateFormData({ academicYear: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Term</label>
                  <select
                    className="input mt-1"
                    value={formData.term}
                    onChange={(e) => updateFormData({ term: e.target.value })}
                  >
                    <option value="First">First Term</option>
                    <option value="Second">Second Term</option>
                    <option value="Third">Third Term</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="e.g., Sciences, Arts"
                  value={formData.department}
                  onChange={(e) => updateFormData({ department: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Availability */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 2: Availability</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Availability Type *</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.availabilityType === 'anytime'}
                      onChange={() => updateFormData({ availabilityType: 'anytime' })}
                    />
                    <span>Available Anytime</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.availabilityType === 'scheduled'}
                      onChange={() => updateFormData({ availabilityType: 'scheduled' })}
                    />
                    <span>Scheduled</span>
                  </label>
                </div>
              </div>

              {formData.availabilityType === 'scheduled' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Start Date *</label>
                      <input
                        type="date"
                        className="input mt-1"
                        value={formData.startDate}
                        onChange={(e) => updateFormData({ startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Start Time *</label>
                      <input
                        type="time"
                        className="input mt-1"
                        value={formData.startTime}
                        onChange={(e) => updateFormData({ startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">End Date *</label>
                      <input
                        type="date"
                        className="input mt-1"
                        value={formData.endDate}
                        onChange={(e) => updateFormData({ endDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">End Time *</label>
                      <input
                        type="time"
                        className="input mt-1"
                        value={formData.endTime}
                        onChange={(e) => updateFormData({ endTime: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="label">Duration (minutes) *</label>
                <input
                  type="number"
                  className="input mt-1"
                  min={1}
                  max={480}
                  value={formData.durationMinutes}
                  onChange={(e) => updateFormData({ durationMinutes: parseInt(e.target.value) || 60 })}
                />
              </div>

              <div>
                <label className="label">Timezone</label>
                <select
                  className="input mt-1"
                  value={formData.timezone}
                  onChange={(e) => updateFormData({ timezone: e.target.value })}
                >
                  <option value="UTC">UTC</option>
                  <option value="GMT">GMT</option>
                  <option value="EST">Eastern Time (EST)</option>
                  <option value="CST">Central Time (CST)</option>
                  <option value="PST">Pacific Time (PST)</option>
                  <option value="WAT">West Africa Time (WAT)</option>
                </select>
              </div>

              <div>
                <label className="label">Late Submission Policy</label>
                <select
                  className="input mt-1"
                  value={formData.lateSubmissionPolicy}
                  onChange={(e) => updateFormData({ lateSubmissionPolicy: e.target.value })}
                >
                  <option value="reject">Reject Late Submissions</option>
                  <option value="accept_penalty">Accept with Penalty</option>
                  <option value="accept">Accept Without Penalty</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Access & Security */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 3: Access & Security</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Generate Passkey</label>
                <button
                  type="button"
                  onClick={() => updateFormData({ passkey: Math.random().toString(36).substring(2, 10).toUpperCase() })}
                  className="btn btn-outline mt-2"
                >
                  Generate Random Passkey
                </button>
                {formData.passkey && (
                  <p className="mt-2 text-sm text-gray-600 font-mono">{formData.passkey}</p>
                )}
              </div>

              <div>
                <label className="label">Or Enter Custom Passkey</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="Enter custom passkey"
                  value={formData.customPasskey}
                  onChange={(e) => updateFormData({ customPasskey: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Maximum Attempts</label>
                <input
                  type="number"
                  className="input mt-1"
                  min={1}
                  max={10}
                  value={formData.maxAttempts}
                  onChange={(e) => updateFormData({ maxAttempts: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.oneDeviceOnly}
                    onChange={(e) => updateFormData({ oneDeviceOnly: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">One Device Only</p>
                    <p className="text-xs text-gray-500">Restrict exam to a single device</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.randomizeQuestions}
                    onChange={(e) => updateFormData({ randomizeQuestions: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Randomize Questions</p>
                    <p className="text-xs text-gray-500">Show questions in random order</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.randomizeOptions}
                    onChange={(e) => updateFormData({ randomizeOptions: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Randomize Options</p>
                    <p className="text-xs text-gray-500">Shuffle MCQ options</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.shuffleStudents}
                    onChange={(e) => updateFormData({ shuffleStudents: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Shuffle Students</p>
                    <p className="text-xs text-gray-500">Randomize student seating</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showTimer}
                    onChange={(e) => updateFormData({ showTimer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Show Timer</p>
                    <p className="text-xs text-gray-500">Display countdown timer</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoSubmit}
                    onChange={(e) => updateFormData({ autoSubmit: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Auto Submit</p>
                    <p className="text-xs text-gray-500">Automatically submit when time expires</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.preventCopyPaste}
                    onChange={(e) => updateFormData({ preventCopyPaste: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Prevent Copy/Paste</p>
                    <p className="text-xs text-gray-500">Disable copy and paste</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requireFullscreen}
                    onChange={(e) => updateFormData({ requireFullscreen: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Require Fullscreen</p>
                    <p className="text-xs text-gray-500">Force fullscreen mode</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4: Results</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Results Display</label>
                <div className="space-y-3 mt-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.showScoreImmediately}
                      onChange={() => updateFormData({ 
                        showScoreImmediately: true,
                        hideResults: false,
                        releaseResultsLater: false 
                      })}
                    />
                    <div>
                      <p className="font-medium text-gray-900">Show Score Immediately</p>
                      <p className="text-xs text-gray-500">Display results right after submission</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.hideResults}
                      onChange={() => updateFormData({ 
                        showScoreImmediately: false,
                        hideResults: true,
                        releaseResultsLater: false 
                      })}
                    />
                    <div>
                      <p className="font-medium text-gray-900">Hide Results</p>
                      <p className="text-xs text-gray-500">Do not show results to students</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.releaseResultsLater}
                      onChange={() => updateFormData({ 
                        showScoreImmediately: false,
                        hideResults: false,
                        releaseResultsLater: true 
                      })}
                    />
                    <div>
                      <p className="font-medium text-gray-900">Release Results Later</p>
                      <p className="text-xs text-gray-500">Publish results on a specific date</p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.releaseResultsLater && (
                <div>
                  <label className="label">Release Date</label>
                  <input
                    type="date"
                    className="input mt-1"
                    value={formData.releaseDate}
                    onChange={(e) => updateFormData({ releaseDate: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-3 pt-4 border-t">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showCorrectAnswers}
                    onChange={(e) => updateFormData({ showCorrectAnswers: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Show Correct Answers</p>
                    <p className="text-xs text-gray-500">Display correct answers after submission</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showExplanations}
                    onChange={(e) => updateFormData({ showExplanations: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Show Explanations</p>
                    <p className="text-xs text-gray-500">Display answer explanations</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.certificateAfterCompletion}
                    onChange={(e) => updateFormData({ certificateAfterCompletion: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Certificate After Completion</p>
                    <p className="text-xs text-gray-500">Issue certificate upon passing</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Payment */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Payment</h2>
            <div className="space-y-6">
              <div>
                <label className="label">Number of Candidates *</label>
                <input
                  type="number"
                  className="input mt-1"
                  min={1}
                  value={formData.numberOfCandidates}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 1;
                    updateFormData({ numberOfCandidates: count });
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Up to 120 candidates: GHS 100 | Additional candidates: GHS 1 each
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Number of Candidates</span>
                    <span className="font-medium">{formData.numberOfCandidates}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price (up to 120)</span>
                    <span className="font-medium">GHS 100</span>
                  </div>
                  {formData.numberOfCandidates > 120 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additional Candidates ({formData.numberOfCandidates - 120} × GHS 1)</span>
                      <span className="font-medium">GHS {formData.numberOfCandidates - 120}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-200 pt-3 flex justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-blue-600">GHS {formData.price}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Payment via Paystack</p>
                    <p className="text-xs text-blue-700 mt-1">
                      You will be redirected to Paystack's secure payment gateway to complete your payment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Payment is required before you can add questions to your exam. 
                  You will be redirected to complete the payment securely.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Question Builder */}
        {currentStep === 6 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 6: Question Builder</h2>
            <div className="border-4 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Question Builder Coming Soon</h3>
              <p className="text-gray-600 mb-4">
                The advanced question builder with import, preview, and intelligent features will be available here.
              </p>
              <p className="text-sm text-gray-500">
                After payment, you'll be able to:
              </p>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• Import questions from PDF, DOCX, TXT, or Images</li>
                <li>• Paste questions and let AI parse them</li>
                <li>• Live preview with edit-in-place</li>
                <li>• Set question properties (type, difficulty, marks)</li>
                <li>• Bulk actions and drag-and-drop reordering</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="btn btn-outline"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/exams')}
              className="btn btn-outline"
            >
              Save as Draft
            </button>
            {currentStep < 6 ? (
              <button onClick={nextStep} className="btn btn-primary">
                Continue →
              </button>
            ) : (
              <button 
                onClick={handlePayment}
                disabled={loading || paymentLoading}
                className="btn btn-primary"
              >
                {loading || paymentLoading ? 'Processing...' : `Pay GHS ${formData.price} & Create Exam`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}