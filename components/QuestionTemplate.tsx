'use client';

import { useState } from 'react';

interface QuestionTemplateProps {
  onClose: () => void;
  onUseTemplate: (templateText: string) => void;
}

export default function QuestionTemplate({ onClose, onUseTemplate }: QuestionTemplateProps) {
  const [templateType, setTemplateType] = useState<'mcq' | 'essay' | 'mixed'>('mixed');
  const [sectionCount, setSectionCount] = useState(1);
  const [questionsPerSection, setQuestionsPerSection] = useState(5);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('');
  const [duration, setDuration] = useState('1 Hour 30 Minutes');

  const generateMCQTemplate = (): string => {
    let template = `GENERAL EXAMINATION\n\n`;
    template += `Subject: ${subject || 'Subject Name'}\n`;
    template += `Class: ${className || 'SHS 1 / SHS 2'}\n`;
    template += `Time Allowed: ${duration}\n\n`;
    template += `INSTRUCTIONS TO CANDIDATES:\n`;
    template += `This paper consists of multiple choice questions.\n\n`;
    template += `SECTION A: OBJECTIVE TEST (${questionsPerSection * 2} MARKS)\n\n`;
    template += `Answer all questions. Each question carries 1 mark.\n\n`;

    for (let i = 1; i <= questionsPerSection; i++) {
      template += `Question ${i}.\n`;
      template += `[Enter your question text here]\n`;
      template += `A) [Option A]\n`;
      template += `B) [Option B]\n`;
      template += `C) [Option C]\n`;
      template += `D) [Option D]\n\n`;
    }

    if (includeAnswerKey) {
      template += `Answer Key:\n`;
      for (let i = 1; i <= questionsPerSection; i++) {
        template += `${i}[Letter]\n`;
      }
    }

    return template;
  };

  const generateEssayTemplate = (): string => {
    let template = `GENERAL EXAMINATION\n\n`;
    template += `Subject: ${subject || 'Subject Name'}\n`;
    template += `Class: ${className || 'SHS 1 / SHS 2'}\n`;
    template += `Time Allowed: ${duration}\n\n`;
    template += `INSTRUCTIONS TO CANDIDATES:\n`;
    template += `This paper consists of essay questions.\n\n`;
    template += `SECTION A: ESSAY QUESTIONS (${questionsPerSection * 5} MARKS)\n\n`;
    template += `Answer all questions. Show all working where applicable.\n\n`;

    for (let i = 1; i <= questionsPerSection; i++) {
      template += `Question ${i} (5 marks)\n`;
      template += `[Enter your essay question here]\n`;
      template += `Marking Scheme:\n`;
      template += `- [Key point 1 (1 mark)]\n`;
      template += `- [Key point 2 (1 mark)]\n`;
      template += `- [Key point 3 (1 mark)]\n`;
      template += `- [Key point 4 (1 mark)]\n`;
      template += `- [Key point 5 (1 mark)]\n\n`;
    }

    return template;
  };

  const generateMixedTemplate = (): string => {
    const mcqCount = Math.ceil(questionsPerSection / 2);
    const essayCount = questionsPerSection - mcqCount;

    let template = `GENERAL EXAMINATION\n\n`;
    template += `Subject: ${subject || 'Subject Name'}\n`;
    template += `Class: ${className || 'SHS 1 / SHS 2'}\n`;
    template += `Time Allowed: ${duration}\n\n`;
    template += `INSTRUCTIONS TO CANDIDATES:\n`;
    template += `This paper consists of two sections: Section A (Objective) and Section B (Essay).\n\n`;
    template += `SECTION A: OBJECTIVE TEST (${mcqCount * 2} MARKS)\n\n`;
    template += `Answer all questions. Each question carries 1 mark.\n\n`;

    for (let i = 1; i <= mcqCount; i++) {
      template += `${i}. [Enter MCQ question text here]\n`;
      template += `A) [Option A]\n`;
      template += `B) [Option B]\n`;
      template += `C) [Option C]\n`;
      template += `D) [Option D]\n\n`;
    }

    template += `SECTION B: ESSAY QUESTIONS (${essayCount * 5} MARKS)\n\n`;
    template += `Answer all questions. Show all relevant working and explanations.\n\n`;

    for (let i = 1; i <= essayCount; i++) {
      template += `Question ${i} (5 marks)\n`;
      template += `[Enter essay question here]\n`;
      template += `Marking Scheme:\n`;
      template += `- [Key point 1]\n`;
      template += `- [Key point 2]\n`;
      template += `- [Key point 3]\n\n`;
    }

    if (includeAnswerKey) {
      template += `Answer Key (Section A):\n`;
      for (let i = 1; i <= mcqCount; i++) {
        template += `${i}[Letter]\n`;
      }
    }

    return template;
  };

  const handleGenerate = () => {
    let template = '';

    switch (templateType) {
      case 'mcq':
        template = generateMCQTemplate();
        break;
      case 'essay':
        template = generateEssayTemplate();
        break;
      case 'mixed':
        template = generateMixedTemplate();
        break;
    }

    onUseTemplate(template);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center overflow-y-auto z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mt-12 mb-12">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Question Template Generator</h3>
            <p className="text-sm text-gray-500 mt-1">
              Generate a structured template to fill in your questions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Template Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTemplateType('mcq')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  templateType === 'mcq'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📝</div>
                <div className="text-sm font-medium">MCQ Only</div>
                <div className="text-xs text-gray-500 mt-1">Multiple choice questions</div>
              </button>

              <button
                onClick={() => setTemplateType('essay')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  templateType === 'essay'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📄</div>
                <div className="text-sm font-medium">Essay Only</div>
                <div className="text-xs text-gray-500 mt-1">Written response questions</div>
              </button>

              <button
                onClick={() => setTemplateType('mixed')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  templateType === 'mixed'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📋</div>
                <div className="text-sm font-medium">Mixed</div>
                <div className="text-xs text-gray-500 mt-1">MCQ + Essay sections</div>
              </button>
            </div>
          </div>

          {/* Exam Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Name
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., General Science"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., SHS 1 / SHS 2"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 1 Hour 30 Minutes"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Questions
              </label>
              <input
                type="number"
                value={questionsPerSection}
                onChange={(e) => setQuestionsPerSection(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="50"
                className="input w-full"
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeAnswerKey"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="includeAnswerKey" className="text-sm text-gray-700">
              Include answer key placeholder at the end
            </label>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
              {templateType === 'mcq' && generateMCQTemplate()}
              {templateType === 'essay' && generateEssayTemplate()}
              {templateType === 'mixed' && generateMixedTemplate()}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
            >
              Use This Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}