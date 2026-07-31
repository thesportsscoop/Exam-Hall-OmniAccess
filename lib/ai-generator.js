/**
 * AI-Powered Question Generator
 * Uses Gemini API with automatic fallback chain:
 * 1. Gemini API Key 1 (primary)
 * 2. Gemini API Key 2 (fallback)
 * 3. Template-based generation (final fallback)
 * 
 * Gemini Free Tier: 60 requests/min, 1500 requests/day
 * Structured to minimize API calls and never hit limits.
 */

// Gemini API configuration
const GEMINI_API_KEYS = [
  '',
  '',
];

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Rate limiting state
const rateLimitState = {
  currentKeyIndex: 0,
  lastRequestTime: 0,
  minRequestInterval: 1000, // 1 second between requests to avoid rate limits
  dailyRequestCount: 0,
  dailyResetTime: Date.now() + 24 * 60 * 60 * 1000,
  maxDailyRequests: 1400, // Leave buffer under 1500 limit
};

// In-memory cache for generated questions to avoid duplicate API calls
const generationCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Build a structured prompt for question generation
 */
function buildQuestionPrompt(topic, format, count = 5) {
  const formatInstruction = format === 'mcq' 
    ? 'Only MULTIPLE CHOICE questions'
    : format === 'essay'
    ? 'Only ESSAY/SUBJECTIVE questions'
    : 'A MIX of multiple choice and essay questions';

  return `You are an expert exam question generator for educational assessments. Generate ${count} high-quality exam questions about the following topic.

Topic: "${topic}"

Requirements:
- ${formatInstruction}
- Each question must be clear, specific, and test meaningful understanding
- Vary difficulty levels (easy, medium, hard)
- Include questions that test different cognitive levels (recall, comprehension, application, analysis)

FOR MCQ QUESTIONS, use this EXACT format:
Q1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Answer: [Letter]

FOR ESSAY QUESTIONS, use this EXACT format:
Q1: [Question text]
Sub-questions:
a) [First sub-question]
b) [Second sub-question]
c) [Third sub-question]
Points: [Number]
Marking Scheme:
- [Criteria 1 with points]
- [Criteria 2 with points]
- [Criteria 3 with points]

Generate at least 3 questions. Ensure all content is educational and appropriate.`;
}

/**
 * Parse Gemini API response into structured questions
 */
function parseGeminiResponse(text, format) {
  const questions = [];
  const lines = text.split('\n').filter(l => l.trim());
  
  let currentQuestion = null;
  let currentType = null;
  let currentOptions = [];
  let currentSubQuestions = [];
  let currentMarkingScheme = '';
  let currentAnswer = '';
  let inMarkingScheme = false;
  let inSubQuestions = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect question start
    const qMatch = line.match(/^Q(\d+)[:\).]\s*(.+)/i);
    if (qMatch) {
      // Save previous question
      if (currentQuestion) {
        questions.push(finalizeQuestion(currentQuestion, currentType, currentOptions, currentSubQuestions, currentMarkingScheme, format, currentAnswer));
      }
      
      currentQuestion = qMatch[2];
      currentType = null;
      currentOptions = [];
      currentSubQuestions = [];
      currentMarkingScheme = '';
      currentAnswer = '';
      inMarkingScheme = false;
      inSubQuestions = false;
      continue;
    }

    if (!currentQuestion) continue;

    // Detect MCQ options
    const optMatch = line.match(/^([A-D])\s*[)\].\s]\s*(.+)/);
    if (optMatch && !inMarkingScheme && !inSubQuestions) {
      currentType = 'mcq';
      currentOptions.push({ label: optMatch[1], text: optMatch[2] });
      continue;
    }

    // Detect answer key - store the correct answer letter
    const answerMatch = line.match(/^Answer:\s*([A-D])/i);
    if (answerMatch) {
      currentAnswer = answerMatch[1].toUpperCase();
      currentType = 'mcq';
      continue;
    }

    // Detect sub-questions
    const subMatch = line.match(/^\(?([a-e])\s*[)\].\s]\s*(.+)/i);
    if (subMatch && !inMarkingScheme) {
      currentType = 'essay';
      inSubQuestions = true;
      currentSubQuestions.push({ label: subMatch[1].toLowerCase(), text: subMatch[2] });
      continue;
    }

    // Detect points
    const pointsMatch = line.match(/^Points?:\s*(\d+)/i);
    if (pointsMatch) {
      continue; // Handled in finalize
    }

    // Detect marking scheme
    if (/^Marking\s*Scheme/i.test(line) || /^Marking\s*Rubric/i.test(line) || /^Rubric:/i.test(line)) {
      inMarkingScheme = true;
      inSubQuestions = false;
      currentMarkingScheme += line + '\n';
      continue;
    }

    if (inMarkingScheme) {
      currentMarkingScheme += line + '\n';
      continue;
    }

    // If we see another section header, stop
    if (/^---/.test(line) || /^Section/.test(line)) {
      continue;
    }
  }

  // Save last question
  if (currentQuestion) {
    questions.push(finalizeQuestion(currentQuestion, currentType, currentOptions, currentSubQuestions, currentMarkingScheme, format, currentAnswer));
  }

  return questions;
}

/**
 * Finalize a parsed question into the standard format
 */
function finalizeQuestion(questionText, type, options, subQuestions, markingScheme, format, correctAnswer = '') {
  if (type === 'mcq' || (options.length >= 2 && !subQuestions.length)) {
    // MCQ question - use the answer from the "Answer:" line if available
    const finalAnswer = correctAnswer || (options.length > 0 ? options[0].label : 'A');
    return {
      type: 'mcq',
      questionText: questionText,
      options: options.slice(0, 5),
      correctAnswer: finalAnswer,
      points: 1,
      markingScheme: '',
    };
  } else {
    // Essay question
    const subText = subQuestions.length > 0 
      ? '\n' + subQuestions.map(sq => `${sq.label}) ${sq.text}`).join('\n')
      : '';
    
    const scheme = markingScheme || generateDefaultMarkingScheme(questionText + subText, 10);
    
    return {
      type: 'essay',
      questionText: questionText + subText,
      options: [],
      correctAnswer: '',
      points: 10,
      markingScheme: scheme,
    };
  }
}

/**
 * Generate a default marking scheme for essay questions
 */
function generateDefaultMarkingScheme(questionText, totalPoints) {
  return `Marking Scheme (Total: ${totalPoints} marks):\n\n` +
    `Expected Key Points:\n` +
    `- Award marks for each correct key point mentioned\n` +
    `- Credit well-structured and clearly explained answers\n\n` +
    `Marking Guidelines:\n` +
    `- Full marks (${totalPoints} pts): Complete, accurate, well-explained answer\n` +
    `- ${Math.ceil(totalPoints * 0.6)}-${totalPoints - 1} pts: Good answer with minor omissions\n` +
    `- ${Math.ceil(totalPoints * 0.3)}-${Math.ceil(totalPoints * 0.6) - 1} pts: Partial answer, some key points missing\n` +
    `- 1-${Math.ceil(totalPoints * 0.3) - 1} pts: Attempt made but largely incorrect\n` +
    `- 0 pts: No attempt or completely off-topic\n`;
}

/**
 * Call Gemini API with retry logic and key rotation
 */
async function callGeminiAPI(prompt) {
  // Check rate limits
  const now = Date.now();
  if (now > rateLimitState.dailyResetTime) {
    rateLimitState.dailyRequestCount = 0;
    rateLimitState.dailyResetTime = now + 24 * 60 * 60 * 1000;
  }

  if (rateLimitState.dailyRequestCount >= rateLimitState.maxDailyRequests) {
    throw new Error('Daily API limit reached');
  }

  // Ensure minimum interval between requests
  const timeSinceLastRequest = now - rateLimitState.lastRequestTime;
  if (timeSinceLastRequest < rateLimitState.minRequestInterval) {
    await new Promise(resolve => setTimeout(resolve, rateLimitState.minRequestInterval - timeSinceLastRequest));
  }

  // Try each API key
  const startIndex = rateLimitState.currentKeyIndex;
  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt++) {
    const keyIndex = (startIndex + attempt) % GEMINI_API_KEYS.length;
    const apiKey = GEMINI_API_KEYS[keyIndex];

    try {
      rateLimitState.lastRequestTime = Date.now();
      
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      rateLimitState.dailyRequestCount++;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (key ${keyIndex}):`, response.status, errorText);
        
        // If rate limited, rotate key
        if (response.status === 429) {
          rateLimitState.currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
          continue;
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid Gemini response format');
      }

      // Update key index for next request (round-robin)
      rateLimitState.currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
      
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error(`Gemini API call failed (key ${keyIndex}):`, error.message);
      
      // If this is the last key, throw
      if (attempt === GEMINI_API_KEYS.length - 1) {
        throw error;
      }
      
      // Rotate key and retry
      rateLimitState.currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
    }
  }

  throw new Error('All Gemini API keys exhausted');
}

/**
 * Template-based fallback generator (same as before)
 */
function generateTemplateQuestions(topic, format) {
  const questions = [];
  const keyTerms = extractKeyTerms(topic);
  const mainTopic = keyTerms[0] || topic.substring(0, 50);

  if (format === 'mcq' || format === 'hybrid') {
    const mcqs = generateMCQFromTemplate(mainTopic, topic);
    questions.push(...mcqs);
  }

  if (format === 'essay' || format === 'hybrid') {
    const essays = generateEssayFromTemplate(mainTopic, topic);
    questions.push(...essays);
  }

  return questions;
}

function extractKeyTerms(text) {
  const words = text.split(/[\s,;:.!?]+/).filter(w => w.length > 3);
  const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'about', 'would', 'could', 'should', 'there', 'these', 'those', 'after', 'before', 'between', 'other', 'under', 'above', 'into', 'over', 'also', 'than', 'then', 'very', 'just', 'because', 'some', 'more', 'most', 'many', 'such', 'only', 'even', 'still', 'while', 'each', 'both', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'along', 'around', 'about', 'across', 'against', 'behind', 'beneath', 'beside', 'beyond', 'inside', 'outside', 'underneath', 'upon', 'within', 'without'];
  return words.filter(w => !stopWords.includes(w.toLowerCase())).slice(0, 5);
}

function generateMCQFromTemplate(topic, prompt) {
  const templates = [
    {
      questionText: `What is the primary definition of ${topic}?`,
      options: [
        { label: 'A', text: `A comprehensive explanation of ${topic} and its key components` },
        { label: 'B', text: `A brief overview of ${topic} without detailed analysis` },
        { label: 'C', text: `A historical perspective on ${topic} development` },
        { label: 'D', text: `A practical application of ${topic} in real-world scenarios` },
      ],
      correctAnswer: 'A',
      points: 1,
    },
    {
      questionText: `Which of the following best describes a key characteristic of ${topic}?`,
      options: [
        { label: 'A', text: `It is primarily focused on theoretical concepts` },
        { label: 'B', text: `It involves systematic analysis and evaluation` },
        { label: 'C', text: `It relies solely on practical experimentation` },
        { label: 'D', text: `It is based on subjective interpretation` },
      ],
      correctAnswer: 'B',
      points: 1,
    },
    {
      questionText: `What is the most important factor to consider when studying ${topic}?`,
      options: [
        { label: 'A', text: `Understanding the fundamental principles` },
        { label: 'B', text: `Memorizing all related facts and figures` },
        { label: 'C', text: `Focusing only on practical applications` },
        { label: 'D', text: `Ignoring historical context` },
      ],
      correctAnswer: 'A',
      points: 1,
    },
    {
      questionText: `How does ${topic} relate to other concepts in its field?`,
      options: [
        { label: 'A', text: `It is completely independent of other concepts` },
        { label: 'B', text: `It builds upon and connects with related principles` },
        { label: 'C', text: `It contradicts established theories` },
        { label: 'D', text: `It has no practical relevance to other areas` },
      ],
      correctAnswer: 'B',
      points: 1,
    },
    {
      questionText: `Which approach is most effective for understanding ${topic}?`,
      options: [
        { label: 'A', text: `A combination of theoretical study and practical application` },
        { label: 'B', text: `Pure theoretical analysis only` },
        { label: 'C', text: `Hands-on practice without theory` },
        { label: 'D', text: `Memorization of key terms and definitions` },
      ],
      correctAnswer: 'A',
      points: 1,
    },
  ];

  const count = prompt.length > 100 ? 5 : 3;
  return templates.slice(0, Math.min(count, templates.length)).map(t => ({ type: 'mcq', ...t }));
}

function generateEssayFromTemplate(topic, prompt) {
  const templates = [
    {
      questionText: `Discuss the fundamental concepts and principles of ${topic}. In your answer:\na) Define ${topic} and explain its core components\nb) Analyze the key factors that influence ${topic}\nc) Evaluate the importance of ${topic} in its field`,
      points: 10,
    },
    {
      questionText: `Analyze the practical applications and implications of ${topic}.\na) Describe at least three real-world applications of ${topic}\nb) Explain the benefits and limitations of each application\nc) Propose ways to overcome the identified limitations`,
      points: 10,
    },
  ];

  const count = prompt.length > 100 ? 2 : 1;
  return templates.slice(0, Math.min(count, templates.length)).map(t => ({
    type: 'essay',
    questionText: t.questionText,
    options: [],
    correctAnswer: '',
    points: t.points,
    markingScheme: generateDefaultMarkingScheme(t.questionText, t.points),
  }));
}

// Cache key for deduplication
function getCacheKey(topic, format) {
  return `${format}:${topic.toLowerCase().trim()}`;
}

/**
 * Main function: Generate questions using AI with fallback chain
 * @param {string} topic - The topic/prompt for question generation
 * @param {string} format - 'mcq', 'essay', or 'hybrid'
 * @returns {Promise<Array>} Array of question objects
 */
export async function generateQuestions(topic, format = 'hybrid') {
  if (!topic || topic.trim().length < 5) {
    throw new Error('Please provide a more detailed topic description (at least 5 characters)');
  }

  const cacheKey = getCacheKey(topic, format);
  
  // Check cache first
  const cached = generationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Returning cached questions for:', cacheKey);
    return cached.questions;
  }

  // Try Gemini API first
  try {
    console.log('Attempting Gemini API generation...');
    const prompt = buildQuestionPrompt(topic, format);
    const responseText = await callGeminiAPI(prompt);
    const questions = parseGeminiResponse(responseText, format);
    
    if (questions.length > 0) {
      console.log(`Gemini generated ${questions.length} questions successfully`);
      // Cache the results
      generationCache.set(cacheKey, { questions, timestamp: Date.now() });
      return questions;
    }
    
    console.log('Gemini returned no valid questions, falling back to templates');
  } catch (geminiError) {
    console.error('Gemini API failed:', geminiError.message);
  }

  // Fallback to template-based generation
  console.log('Using template-based fallback generation');
  const templateQuestions = generateTemplateQuestions(topic, format);
  
  if (templateQuestions.length === 0) {
    throw new Error('Could not generate questions from the provided topic. Please try a more specific description.');
  }

  return templateQuestions;
}