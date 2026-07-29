'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'seeding' | 'done'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [mongoStatus, setMongoStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkMongoDB = async () => {
    setStatus('checking');
    setLogs([]);
    addLog('Checking MongoDB connection...');

    try {
      const res = await fetch('/api/setup/check-db');
      const data = await res.json();

      if (res.ok && data.connected) {
        setMongoStatus('connected');
        addLog(`✓ MongoDB connected successfully`);
        addLog(`Database: ${data.database || 'alta-vista'}`);
        return true;
      } else {
        setMongoStatus('error');
        addLog(`✗ MongoDB connection failed: ${data.error}`);
        addLog('');
        addLog('SOLUTION:');
        addLog('1. Install MongoDB: https://www.mongodb.com/try/download/community');
        addLog('2. Or use MongoDB Atlas (free cloud): https://www.mongodb.com/atlas/database');
        addLog('3. Update MONGODB_URI in .env.local');
        return false;
      }
    } catch (error) {
      setMongoStatus('error');
      addLog(`✗ Error checking database: ${error}`);
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const seedAdmin = async () => {
    setStatus('seeding');
    setLogs([]);
    addLog('Creating super admin user...');

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        addLog(`✓ ${data.message}`);
        addLog(`Email: ${data.email}`);
        addLog(`Password: eddy123`);
        addLog('');
        addLog('You can now login with these credentials!');
        setStatus('done');
        toast.success('Admin user created successfully!');
      } else {
        addLog(`✗ Error: ${data.error}`);
        toast.error(data.error || 'Failed to seed admin');
      }
    } catch (error) {
      addLog(`✗ Error: ${error}`);
      toast.error('Failed to seed admin');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Exam Hall OmniAccess</h1>
          <p className="text-gray-600">Setup & Configuration</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* MongoDB Status */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">1. MongoDB Database</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                mongoStatus === 'connected' ? 'bg-green-100 text-green-800' :
                mongoStatus === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {mongoStatus === 'connected' ? 'Connected' : mongoStatus === 'error' ? 'Error' : 'Not Checked'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Check if your MongoDB database is accessible.
            </p>
            <button
              onClick={checkMongoDB}
              disabled={status !== 'idle'}
              className="btn btn-primary w-full"
            >
              {status === 'checking' ? 'Checking...' : 'Check MongoDB Connection'}
            </button>
          </div>

          {/* Seed Admin */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Create Admin User</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create the super admin account to access the admin dashboard.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <p className="text-xs text-blue-700">
                <strong>Credentials:</strong> eddy@altavista.com / eddy123
              </p>
            </div>
            <button
              onClick={seedAdmin}
              disabled={status !== 'idle'}
              className="btn btn-primary w-full"
            >
              {status === 'seeding' ? 'Creating...' : 'Create Admin User'}
            </button>
          </div>

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Console Output</span>
                <button
                  onClick={() => setLogs([])}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {status === 'done' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">Next Steps:</h3>
              <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
                <li>Go to <a href="/login" className="underline">/login</a></li>
                <li>Login with eddy@altavista.com / eddy123</li>
                <li>Access the admin dashboard</li>
                <li>Register teachers via the admin panel</li>
              </ol>
            </div>
          )}

          {/* Manual Setup Instructions */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Configuration (.env.local)</h3>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700">
              <p className="mb-2"># MongoDB (choose one)</p>
              <p className="mb-1">MONGODB_URI=mongodb://localhost:27017/alta-vista</p>
              <p className="mb-4"># MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/alta-vista</p>
              <p className="mb-2"># JWT Secret</p>
              <p className="mb-4">JWT_SECRET=your-super-secret-jwt-key</p>
              <p className="mb-2"># App URL</p>
              <p>NEXT_PUBLIC_APP_URL=http://localhost:3000</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}