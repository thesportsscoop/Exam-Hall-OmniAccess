'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function CreateExamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [examCreated, setExamCreated] = useState(false);
  const [createdExamId, setCreatedExamId] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    durationMinutes: 60,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    passkey: '',
    format: 'mcq',
    classes: '',
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
        setPaymentReference(reference);
        toast.success('Payment verified successfully!');
      } else {
        toast.error(data.error || 'Payment verification failed');
      }
    } catch (error) {
      toast.error('Failed to verify payment');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePayAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title || !formData.durationMinutes || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime || !formData.passkey) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.passkey.length < 4) {
      toast.error('Passkey must be at least 4 characters');
      return;
    }

    setLoading(true);

    try {
      // 1. Get current user info
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.user) {
        toast.error('Please login again');
        router.push('/login');
        return;
      }

      // 2. Initialize payment
      setPaymentLoading(true);
      const payRes = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: meData.user.email,
          metadata: {
            examTitle: formData.title,
          },
        }),
      });

      const payData = await payRes.json();

      if (!payRes.ok) {
        toast.error(payData.error || 'Payment initialization failed');
        setPaymentLoading(false);
        setLoading(false);
        return;
      }

      // 3. Save form data to sessionStorage and redirect to Paystack
      sessionStorage.setItem('pendingExam', JSON.stringify(formData));
      window.location.href = payData.authorizationUrl;
    } catch (error) {
      toast.error('Something went wrong');
      setLoading(false);
      setPaymentLoading(false);
    }
  };

  // After payment, check for saved form data and create exam
  useEffect(() => {
    if (paymentCompleted) {
      const savedData = sessionStorage.getItem('pendingExam');
      if (savedData) {
        createExamAfterPayment(JSON.parse(savedData));
        sessionStorage.removeItem('pendingExam');
      }
    }
  }, [paymentCompleted]);

  const createExamAfterPayment = async (data: any) => {
    try {
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = new Date(`${data.endDate}T${data.endTime}`);

      const res = await fetch('/api/teacher/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          durationMinutes: parseInt(data.durationMinutes),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          passkey: data.passkey,
          format: data.format,
          classes: data.classes ? data.classes.split(',').map((c: string) => c.trim()).filter(Boolean) : [],
          isPaid: true,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Failed to create exam');
        return;
      }

      setExamCreated(true);
      setCreatedExamId(result.exam._id);
      toast.success('Exam created successfully!');
    } catch (error) {
      toast.error('Failed to create exam after payment');
    }
  };

  const formatOptions = [
    { value: 'mcq', label: 'Multiple Choice (MCQ)' },
    { value: 'essay', label: 'Essay' },
    { value: 'hybrid', label: 'Hybrid (MCQ + Essay)' },
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
            Payment of GHS 100 has been completed. You can now add questions to your exam.
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
          <p className="text-gray-600">
            Please complete the payment of GHS 100 to create your exam.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Exam</h1>
        <p className="text-gray-600 mt-1">
          Fill in the exam configuration details. A one-time fee of <strong>GHS 100</strong> is required.
        </p>
      </div>

      <form onSubmit={handlePayAndCreate} className="space-y-6">
        {/* Exam Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Details</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="label">Exam Title *</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className="input mt-1"
                placeholder="e.g., Mathematics Mid-Term Exam"
                value={formData.title}
                onChange={handleChange}
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="description" className="label">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="input mt-1 min-h-[80px]"
                placeholder="Optional description for students"
                value={formData.description}
                onChange={handleChange}
                maxLength={500}
              />
            </div>

            <div>
              <label htmlFor="format" className="label">Exam Format *</label>
              <select
                id="format"
                name="format"
                required
                className="input mt-1"
                value={formData.format}
                onChange={handleChange}
              >
                {formatOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="durationMinutes" className="label">Duration (minutes) *</label>
              <input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                required
                min={1}
                max={480}
                className="input mt-1"
                value={formData.durationMinutes}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="classes" className="label">Class Groups (comma separated)</label>
              <input
                id="classes"
                name="classes"
                type="text"
                className="input mt-1"
                placeholder="e.g., Grade 10A, Grade 10B"
                value={formData.classes}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="label">Start Date *</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                required
                className="input mt-1"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="startTime" className="label">Start Time *</label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                required
                className="input mt-1"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="endDate" className="label">End Date *</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                required
                className="input mt-1"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="endTime" className="label">End Time *</label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                required
                className="input mt-1"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Passkey */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h2>

          <div>
            <label htmlFor="passkey" className="label">Exam Passkey *</label>
            <p className="text-xs text-gray-500 mt-1 mb-2">
              Students will use this passkey to access the exam. Must be unique and at least 4 characters.
            </p>
            <input
              id="passkey"
              name="passkey"
              type="text"
              required
              minLength={4}
              className="input mt-1 font-mono"
              placeholder="e.g., MATH-2024"
              value={formData.passkey}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-gray-600">Exam Creation Fee</span>
            <span className="text-gray-900 font-medium">GHS 100</span>
          </div>
          <div className="flex items-center justify-between py-3 font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">GHS 100</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Payment is processed securely via Paystack. You will be redirected to complete payment.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? 'Processing...' : 'Pay GHS 100 & Create Exam'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/exams')}
            className="btn btn-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}