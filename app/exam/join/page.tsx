'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function JoinExamPage() {
  const router = useRouter();
  const [surname, setSurname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [className, setClassName] = useState('');
  const [passkey, setPasskey] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!surname.trim()) {
      toast.error('Please enter your surname');
      return;
    }
    if (!firstName.trim()) {
      toast.error('Please enter your first name');
      return;
    }
    if (!passkey.trim()) {
      toast.error('Please enter the exam passkey');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/exam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surname: surname.trim(),
          firstName: firstName.trim(),
          className: className.trim(),
          passkey: passkey.trim(),
        }),
      });

      const data = await res.json();

      // If the exam requires a class and none was provided, surface the class
      // dropdown so the student can pick one, rather than failing outright.
      if (res.status === 400 && data.requiredClass && data.classes?.length > 0) {
        setAvailableClasses(data.classes);
        toast.error(data.error || 'Please select your class');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || 'Failed to join exam');
        setLoading(false);
        return;
      }

      // Store student info in sessionStorage for the exam page
      sessionStorage.setItem('examStudent', JSON.stringify(data.student));
      sessionStorage.setItem('examData', JSON.stringify(data.exam));
      sessionStorage.setItem('examQuestions', JSON.stringify(data.questions));

      router.push(`/exam/${data.exam.id}`);
    } catch (error) {
      toast.error('Failed to join exam');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join an Exam</h1>
          <p className="text-gray-600">No registration required - just enter your details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="surname" className="label">Surname</label>
              <input
                id="surname"
                type="text"
                className="input mt-1"
                placeholder="Doe"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <label htmlFor="firstName" className="label">First Name</label>
              <input
                id="firstName"
                type="text"
                className="input mt-1"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label htmlFor="className" className="label">
              Class {availableClasses.length > 0 && <span className="text-red-500">*</span>}
            </label>
            {availableClasses.length > 0 ? (
              <select
                id="className"
                className="input mt-1"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              >
                <option value="">Select your class</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                id="className"
                type="text"
                className="input mt-1"
                placeholder="e.g., Grade 10A (optional)"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            )}
          </div>

          <div>
            <label htmlFor="passkey" className="label">Exam Passkey</label>
            <input
              id="passkey"
              type="text"
              className="input mt-1 text-center text-lg font-mono uppercase tracking-wider"
              placeholder="Enter passkey"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value.toUpperCase())}
              maxLength={20}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Ask your teacher for the exam passkey
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-base"
          >
            {loading ? 'Joining...' : 'Start Exam'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}