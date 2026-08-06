'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type TabType = 'teacher' | 'student';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('teacher');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [studentData, setStudentData] = useState({
    surname: '',
    firstName: '',
    className: '',
    passkey: '',
  });

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? formData
        : { email: formData.email, password: formData.password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong');
        return;
      }

      toast.success(isRegister ? 'Account created!' : 'Logged in successfully!');

      // Redirect based on role
      if (data.user.role === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      if (!studentData.surname.trim() || !studentData.firstName.trim() || !studentData.className.trim() || !studentData.passkey.trim()) {
        toast.error('Please fill in all fields');
        setLoading(false);
        return;
      }

      // Store student data in sessionStorage
      sessionStorage.setItem('examStudent', JSON.stringify({
        surname: studentData.surname.trim(),
        firstName: studentData.firstName.trim(),
        className: studentData.className.trim(),
      }));

      // Validate passkey and join the exam
      const res = await fetch('/api/exam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surname: studentData.surname.trim(),
          firstName: studentData.firstName.trim(),
          className: studentData.className.trim(),
          passkey: studentData.passkey.toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Invalid passkey');
        return;
      }

      toast.success('Exam found! Redirecting...');
      
      // Store exam data and redirect
      sessionStorage.setItem('examData', JSON.stringify(data.exam));
      sessionStorage.setItem('examQuestions', JSON.stringify(data.questions));
      
      setTimeout(() => {
        router.push(`/exam/${data.exam.id}`);
      }, 1000);
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Exam Hall OmniAccess
          </h1>
          <p className="text-lg text-gray-600">
            Secure, reliable online assessments for modern education
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('teacher')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'teacher'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Teachers
            </button>
            <button
              onClick={() => setActiveTab('student')}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'student'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Students
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'teacher' ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {isRegister ? 'Create Teacher Account' : 'Teacher Sign In'}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {isRegister
                    ? 'Set up your account to create and manage exams'
                    : 'Access your exam dashboard'}
                </p>

                <form onSubmit={handleTeacherSubmit} className="space-y-4">
                  {isRegister && (
                    <div>
                      <label htmlFor="name" className="label">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        className="input mt-1"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="label">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="input mt-1"
                      placeholder="teacher@school.edu"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="label">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      className="input mt-1"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full"
                  >
                    {loading
                      ? 'Processing...'
                      : isRegister
                      ? 'Create Account'
                      : 'Sign In'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setFormData({ name: '', email: '', password: '' });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {isRegister
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Register"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Take an Exam
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter your exam passkey and details to begin
                </p>

                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="surname" className="label">
                        Surname
                      </label>
                      <input
                        id="surname"
                        type="text"
                        required
                        className="input mt-1"
                        placeholder="Doe"
                        value={studentData.surname}
                        onChange={(e) => setStudentData({ ...studentData, surname: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="firstName" className="label">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        required
                        className="input mt-1"
                        placeholder="John"
                        value={studentData.firstName}
                        onChange={(e) => setStudentData({ ...studentData, firstName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="className" className="label">
                      Class
                    </label>
                    <input
                      id="className"
                      type="text"
                      required
                      className="input mt-1"
                      placeholder="Form 3A"
                      value={studentData.className}
                      onChange={(e) => setStudentData({ ...studentData, className: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor="passkey" className="label">
                      Exam Passkey
                    </label>
                    <input
                      id="passkey"
                      type="text"
                      required
                      className="input mt-1"
                      placeholder="Enter exam passkey"
                      value={studentData.passkey}
                      onChange={(e) => setStudentData({ ...studentData, passkey: e.target.value.toUpperCase() })}
                      maxLength={20}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full"
                  >
                    {loading ? 'Loading...' : 'Start Exam'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Exam Hall OmniAccess. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}