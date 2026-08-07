'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface Submission {
  _id: string;
  studentName: string;
  classGroup: string;
  score: number;
  maxScore: number;
  isGraded: boolean;
  submittedAt: string;
  answers?: any[];
}

interface Analytics {
  totalSubmissions: number;
  avgScore: number;
  avgPercentage: number;
  distribution: Record<string, number>;
}

interface ClassResults {
  className: string;
  submissions: Submission[];
  analytics: {
    totalSubmissions: number;
    avgScore: number;
    avgPercentage: number;
    distribution: Record<string, number>;
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [byClass, setByClass] = useState<Record<string, Submission[]>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [classResults, setClassResults] = useState<ClassResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Submission | null>(null);
  const [studentDetailOpen, setStudentDetailOpen] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [examId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/results`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load results');
        return;
      }
      setSubmissions(data.submissions);
      setByClass(data.byClass);
      setAnalytics(data.analytics);

      const classEntries = Object.entries(data.byClass || {});
      const results: ClassResults[] = classEntries.map(([className, classSubs]) => {
        const subs = classSubs as Submission[];
        const totalSubmissions = subs.length;
        const avgScore = totalSubmissions > 0
          ? Math.round(subs.reduce((sum, s) => sum + s.score, 0) / totalSubmissions)
          : 0;
        const avgPercentage = totalSubmissions > 0
          ? Math.round(subs.reduce((sum, s) => sum + (s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0), 0) / totalSubmissions)
          : 0;

        const distribution = {
          '90-100': 0,
          '80-89': 0,
          '70-79': 0,
          '60-69': 0,
          '50-59': 0,
          '0-49': 0,
        };

        subs.forEach((s) => {
          const pct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
          if (pct >= 90) distribution['90-100']++;
          else if (pct >= 80) distribution['80-89']++;
          else if (pct >= 70) distribution['70-79']++;
          else if (pct >= 60) distribution['60-69']++;
          else if (pct >= 50) distribution['50-59']++;
          else distribution['0-49']++;
        });

        return {
          className,
          submissions: subs,
          analytics: {
            totalSubmissions,
            avgScore,
            avgPercentage,
            distribution,
          },
        };
      });

      setClassResults(results);
    } catch (error) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const openStudentDetail = async (submissionId: string) => {
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/submissions/${submissionId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load student result');
        return;
      }
      setSelectedStudent(data.submission);
      setStudentDetailOpen(true);
    } catch (error) {
      toast.error('Failed to load student result');
    }
  };

  const closeStudentDetail = () => {
    setStudentDetailOpen(false);
    setSelectedStudent(null);
  };

  const getTableRows = (classSubs: Submission[], includeClass = false) => {
    const headers = ['Student Name', 'Score', 'Max Score', 'Percentage', 'Position', 'Submitted At', 'Status'];
    // Sort by percentage descending, then by score descending for ties
    const sortedSubs = [...classSubs].sort((a, b) => {
      const pctA = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
      const pctB = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
      if (pctB !== pctA) return pctB - pctA;
      return b.score - a.score;
    });
    const rows = sortedSubs.map((s, idx) => {
      const row: any[] = [
        s.studentName,
        s.score,
        s.maxScore,
        s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) + '%' : '0%',
        idx + 1,
        new Date(s.submittedAt).toLocaleString(),
        s.isGraded ? 'Graded' : 'Pending',
      ];
      if (includeClass) {
        row.splice(1, 0, s.classGroup || 'No Class');
      }
      return row;
    });

    if (includeClass) {
      headers.splice(1, 0, 'Class');
    }

    return { headers, rows };
  };

  const exportToCSV = (className?: string) => {
    const classLabel = className || 'all';
    const subsToExport = className ? (byClass[className] || []) : submissions;

    if (subsToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const { headers, rows } = getTableRows(subsToExport, className === 'all');
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${examId}${classLabel !== 'all' ? `-${classLabel}` : ''}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success(`Results exported successfully for ${classLabel === 'all' ? 'all classes' : classLabel}`);
  };

  const exportToExcel = (className?: string) => {
    const classLabel = className || 'all';
    const subsToExport = className ? (byClass[className] || []) : submissions;

    if (subsToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const { headers, rows } = getTableRows(subsToExport, className === 'all');

    const buildTable = (title: string) => {
      const style = `
        <style>
          * { font-family: Arial, sans-serif; font-size: 11pt; }
          h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4pt; }
          h2 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; }
          p { font-size: 10pt; margin: 2pt 0; }
          table { 
            border-collapse: collapse; 
            font-family: Arial, sans-serif; 
            font-size: 10pt; 
            margin-top: 10pt;
            width: 100%;
          }
          th { 
            border: 1px solid #000; 
            padding: 6px 8px; 
            text-align: center;
            background-color: #4472C4; 
            color: #ffffff; 
            font-weight: bold;
          }
          td { 
            border: 1px solid #000; 
            padding: 5px 8px; 
            text-align: left;
          }
          td:nth-child(1), td:nth-child(4), td:nth-child(5), td:nth-child(6) {
            text-align: center;
          }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      `;

      const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
      const bodyRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('');

      return `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8" />
            ${style}
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Results</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines>1</x:DisplayGridlines>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
          </head>
          <body>
            <h1>Exam Results Report</h1>
            <h2>${title}</h2>
            <p><strong>Total Students:</strong> ${subsToExport.length}</p>
            <table>
              <thead><tr>${headerRow}</tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </body>
        </html>
      `;
    };

    const title = className ? `Exam Results - ${className}` : 'Exam Results - All Classes';
    const html = buildTable(title);

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${examId}${classLabel !== 'all' ? `-${classLabel}` : ''}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success(`Excel exported for ${classLabel === 'all' ? 'all classes' : classLabel}`);
  };

  const exportToPDF = (className?: string, singleStudent = false) => {
    if (singleStudent && selectedStudent) {
      const lines = [
        `Student: ${selectedStudent.studentName}`,
        `Class: ${selectedStudent.classGroup || 'No Class'}`,
        `Score: ${selectedStudent.score}/${selectedStudent.maxScore}`,
        `Percentage: ${selectedStudent.maxScore > 0 ? Math.round((selectedStudent.score / selectedStudent.maxScore) * 100) : 0}%`,
        `Submitted: ${new Date(selectedStudent.submittedAt).toLocaleString()}`,
      ];

      if ((selectedStudent.answers?.length ?? 0) > 0) {
        lines.push('', 'Answers:');
        selectedStudent.answers!.forEach((a, idx) => {
          const q = (a as any).question;
          lines.push(`${idx + 1}. ${q?.questionText || 'Question'}`);
          lines.push(`   Answer: ${a.answer}`);
          if (a.pointsAwarded !== undefined && q?.points !== undefined) {
            lines.push(`   Points: ${a.pointsAwarded}/${q.points}`);
          }
        });
      }

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Popup blocked. Please allow popups to export PDF.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`<pre style="font-family: Arial, sans-serif; font-size: 14px; white-space: pre-wrap;">${lines.join('\n')}</pre>`);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        toast.success('PDF export opened');
      };
      return;
    }

    const classLabel = className || 'all';
    const subsToExport = className ? (byClass[className] || []) : submissions;

    if (subsToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const { headers, rows } = getTableRows(subsToExport, className === 'all');

    const buildTable = (title: string) => {
      const style = `
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; width: 100%; }
          th, td { border: 1px solid #333; padding: 8px 10px; text-align: left; }
          th { background: #f3f3f3; }
          h2 { font-family: Arial, sans-serif; font-size: 18px; }
          p { font-family: Arial, sans-serif; font-size: 12px; }
        </style>
      `;

      const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
      const bodyRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('');

      return `
        <html>
          <head>
            <meta charset="utf-8" />
            ${style}
          </head>
          <body>
            <h2>${title}</h2>
            <p>Total students: ${subsToExport.length}</p>
            <table>
              <thead><tr>${headerRow}</tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </body>
        </html>
      `;
    };

    const title = className ? `Exam Results - ${className}` : 'Exam Results - All Classes';
    const html = buildTable(title);

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to export PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      toast.success(`PDF export opened for ${classLabel === 'all' ? 'all classes' : classLabel}`);
    };
  };

  const copyToClipboard = async (className?: string, singleStudent?: boolean) => {
    if (singleStudent && selectedStudent) {
      const lines = [
        `Student: ${selectedStudent.studentName}`,
        `Class: ${selectedStudent.classGroup || 'No Class'}`,
        `Score: ${selectedStudent.score}/${selectedStudent.maxScore}`,
        `Percentage: ${selectedStudent.maxScore > 0 ? Math.round((selectedStudent.score / selectedStudent.maxScore) * 100) : 0}%`,
        `Submitted: ${new Date(selectedStudent.submittedAt).toLocaleString()}`,
      ];

      if ((selectedStudent.answers?.length ?? 0) > 0) {
        lines.push('', 'Answers:');
        selectedStudent.answers!.forEach((a, idx) => {
          const q = (a as any).question;
          lines.push(`${idx + 1}. ${q?.questionText || 'Question'}`);
          lines.push(`   Answer: ${a.answer}`);
          if (a.pointsAwarded !== undefined && q?.points !== undefined) {
            lines.push(`   Points: ${a.pointsAwarded}/${q.points}`);
          }
        });
      }

      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        toast.success('Student result copied');
        return;
      } catch (error) {
        toast.error('Failed to copy result');
        return;
      }
    }

    const classLabel = className || 'all';
    const subsToExport = className ? (byClass[className] || []) : submissions;

    if (subsToExport.length === 0) {
      toast.error('No data to copy');
      return;
    }

    const { headers, rows } = getTableRows(subsToExport, className === 'all');

    const tabSeparated = [
      headers.join('\t'),
      ...rows.map((row) => row.map((cell) => cell ?? '').join('\t')),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(tabSeparated);
      toast.success(`Results copied for ${classLabel === 'all' ? 'all classes' : classLabel}`);
    } catch (error) {
      toast.error('Failed to copy results');
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getBarColor = (range: string) => {
    if (range === '90-100') return 'bg-green-500';
    if (range === '80-89') return 'bg-blue-500';
    if (range === '70-79') return 'bg-yellow-500';
    if (range === '60-69') return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const displayedSubmissions = selectedClass === 'all' ? submissions : byClass[selectedClass] || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-gray-600 mt-1">Performance analytics and grade distribution by class</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportToCSV()} className="btn btn-outline text-sm">
            Export CSV
          </button>
          <button onClick={() => exportToExcel()} className="btn btn-outline text-sm">
            Export Excel
          </button>
          <button onClick={() => exportToPDF()} className="btn btn-outline text-sm">
            Export PDF
          </button>
          <button onClick={() => copyToClipboard()} className="btn btn-outline text-sm">
            Copy Results
          </button>
          <button
            onClick={() => router.push(`/dashboard/exams/${examId}`)}
            className="btn btn-outline text-sm"
          >
            Back to Exam
          </button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Submissions</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.totalSubmissions}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Average Score</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.avgScore} pts</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Average Percentage</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.avgPercentage}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Classes</p>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(byClass).length}</p>
          </div>
        </div>
      )}

      {Object.keys(byClass).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Classes</option>
              {Object.keys(byClass).map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({byClass[cls].length})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {selectedClass === 'all' && classResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {classResults.map((classResult) => {
            const topStudents = [...classResult.submissions]
              .sort((a, b) => (b.score / b.maxScore) - (a.score / a.maxScore))
              .slice(0, 3);

            return (
              <div
                key={classResult.className}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow aspect-square flex flex-col"
              >
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {classResult.className}
                    </span>
                    <span className="text-xs text-gray-500">
                      {classResult.analytics.totalSubmissions} students
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {classResult.className}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Avg: {classResult.analytics.avgPercentage}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span>Avg Score: {classResult.analytics.avgScore} pts</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Top Students:</p>
                    <div className="space-y-1">
                      {topStudents.map((student, idx) => {
                        const pct = student.maxScore > 0 ? Math.round((student.score / student.maxScore) * 100) : 0;
                        return (
                          <div key={student._id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 truncate flex-1">
                              {idx + 1}. {student.studentName}
                            </span>
                            <span className={`ml-2 font-medium ${getPercentageColor(pct)}`}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => exportToCSV(classResult.className)}
                    className="flex-1 btn btn-outline text-xs py-2"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => exportToPDF(classResult.className)}
                    className="flex-1 btn btn-outline text-xs py-2"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => copyToClipboard(classResult.className)}
                    className="flex-1 btn btn-outline text-xs py-2"
                  >
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analytics && selectedClass === 'all' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Score Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.distribution).map(([range, count]) => {
              const maxCount = Math.max(...Object.values(analytics.distribution));
              const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={range} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-gray-600 text-right">{range}%</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${getBarColor(range)} flex items-center justify-end px-2 transition-all`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {count > 0 && <span className="text-xs text-white font-medium">{count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(selectedClass !== 'all' || classResults.length === 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Submissions {selectedClass !== 'all' && `- ${selectedClass}`}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{displayedSubmissions.length} students</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportToCSV(selectedClass)} className="btn btn-outline text-xs">
                  CSV
                </button>
                <button onClick={() => exportToExcel(selectedClass)} className="btn btn-outline text-xs">
                  Excel
                </button>
                <button onClick={() => exportToPDF(selectedClass)} className="btn btn-outline text-xs">
                  PDF
                </button>
                <button onClick={() => copyToClipboard(selectedClass)} className="btn btn-outline text-xs">
                  Copy
                </button>
              </div>
            </div>
          </div>

          {displayedSubmissions.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2v-5z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
              <p className="text-gray-500">Results will appear here once students submit their exams.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Student Name</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Max Score</th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Percentage</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-gray-500 uppercase">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedSubmissions
                    .slice()
                    .sort((a, b) => {
                      const pctA = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
                      const pctB = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                      if (pctB !== pctA) return pctB - pctA;
                      return b.score - a.score;
                    })
                    .map((sub, idx) => {
                      const percentage = sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0;
                      return (
                        <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-700">
                                  {sub.studentName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{sub.studentName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-600">{sub.classGroup || 'No Class'}</td>
                          <td className="py-4 px-6 text-center">
                            <span className="text-sm font-medium text-gray-900">
                              {sub.score}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center text-sm text-gray-600">
                            {sub.maxScore}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPercentageColor(percentage)}`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              sub.isGraded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {sub.isGraded ? 'Graded' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => openStudentDetail(sub._id)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {studentDetailOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Student Result</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedStudent.studentName} • {selectedStudent.classGroup || 'No Class'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(undefined, true)} className="btn btn-outline text-xs">
                  Copy
                </button>
                <button onClick={() => exportToPDF(undefined, true)} className="btn btn-outline text-xs">
                  PDF
                </button>
                <button onClick={closeStudentDetail} className="btn btn-outline text-xs">
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Score</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedStudent.score}/{selectedStudent.maxScore}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Percentage</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedStudent.maxScore > 0 ? Math.round((selectedStudent.score / selectedStudent.maxScore) * 100) : 0}%
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Submitted</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(selectedStudent.submittedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Answer Breakdown</h3>
                {(selectedStudent.answers?.length ?? 0) === 0 ? (
                  <p className="text-gray-500">No answers available.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedStudent.answers!.map((a: any, idx: number) => {
                      const q = a.question;
                      return (
                        <div key={a.questionId} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">Question {idx + 1}</p>
                            <span className="text-sm font-medium text-gray-700">{a.pointsAwarded}/{q?.points ?? a.pointsAwarded} pts</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3">{q?.questionText || 'Question'}</p>

                          {q?.type === 'mcq' && q.options?.length > 0 && (
                            <div className="text-xs space-y-1">
                              <p className={`${a.isCorrect ? 'text-green-600' : 'text-red-600'}`}>Your answer: {a.answer}</p>
                              {!a.isCorrect && <p className="text-green-600">Correct answer: {q.correctAnswer}</p>}
                            </div>
                          )}

                          {(q?.type === 'true_false' || q?.type === 'fill_blank') && (
                            <div className="text-xs space-y-1">
                              <p className={`${a.isCorrect ? 'text-green-600' : 'text-red-600'}`}>Your answer: {a.answer || '(No answer)'}</p>
                              {!a.isCorrect && <p className="text-green-600">Correct answer: {q.correctAnswer}</p>}
                            </div>
                          )}

                          {(q?.type === 'essay' || q?.type === 'short_answer') && (
                            <div className="text-xs space-y-1">
                              <p className="text-gray-600">Your answer: {a.answer || '(No answer)'}</p>
                              {a.matchedKeywords?.length > 0 && (
                                <p className="text-green-600">Matched keywords: {a.matchedKeywords.join(', ')}</p>
                              )}
                              {a.feedback && <p className="text-blue-600">{a.feedback}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}