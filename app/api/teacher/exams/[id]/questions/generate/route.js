import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

// Template-based question generator
// Generates questions from a topic/prompt using predefined templates
function generateQuestionsFromPrompt(prompt, format) {
  const promptLower = prompt.toLowerCase();
  const questions = [];
  
  // Extract key terms from the prompt
  const keyTerms = extractKeyTerms(prompt);
  const topicName = keyTerms.length > 0 ? keyTerms[0] : prompt.substring(0, 50);
  
  if (format === 'mcq' || format === 'hybrid') {
    // Generate MCQ questions based on the topic
    const mcqTemplates = generateMCQTemplates(topicName, prompt);
    questions.push(...mcqTemplates);
  }
  
  if (format === 'essay' || format === 'hybrid') {
    // Generate essay questions based on the topic
    const essayTemplates = generateEssayTemplates(topicName, prompt);
    questions.push(...essayTemplates);
  }
  
  return questions;
}

function extractKeyTerms(text) {
  // Extract meaningful terms from the prompt
  const words = text.split(/[\s,;:.!?]+/).filter(w => w.length > 3);
  const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'about', 'would', 'could', 'should', 'there', 'these', 'those', 'after', 'before', 'between', 'other', 'under', 'above', 'into', 'over', 'also', 'than', 'then', 'very', 'just', 'because', 'some', 'more', 'most', 'many', 'such', 'only', 'even', 'still', 'while', 'each', 'both', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'along', 'around', 'about', 'across', 'against', 'behind', 'beneath', 'beside', 'beyond', 'inside', 'outside', 'underneath', 'upon', 'within', 'without'];
  return words.filter(w => !stopWords.includes(w.toLowerCase())).slice(0, 5);
}

function generateMCQTemplates(topic, prompt) {
  const questions = [];
  const topicWords = topic.split(/\s+/);
  const mainTopic = topicWords[0] || 'the topic';
  
  // Template-based MCQ generation
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
      questionText: `How does ${mainTopic} relate to other concepts in its field?`,
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
  
  // Select appropriate number of questions based on prompt length
  const count = prompt.length > 100 ? 5 : 3;
  for (let i = 0; i < Math.min(count, templates.length); i++) {
    questions.push({
      type: 'mcq',
      ...templates[i],
    });
  }
  
  return questions;
}

function generateEssayTemplates(topic, prompt) {
  const questions = [];
  const topicWords = topic.split(/\s+/);
  const mainTopic = topicWords[0] || 'the topic';
  
  const templates = [
    {
      questionText: `Discuss the fundamental concepts and principles of ${topic}. In your answer:\na) Define ${topic} and explain its core components\nb) Analyze the key factors that influence ${topic}\nc) Evaluate the importance of ${topic} in its field`,
      points: 10,
    },
    {
      questionText: `Analyze the practical applications and implications of ${topic}.\na) Describe at least three real-world applications of ${topic}\nb) Explain the benefits and limitations of each application\nc) Propose ways to overcome the identified limitations`,
      points: 10,
    },
    {
      questionText: `Critically evaluate the role and significance of ${topic} in modern context.\na) Compare and contrast different perspectives on ${topic}\nb) Assess the strengths and weaknesses of current approaches\nc) Suggest future directions for research or development in ${topic}`,
      points: 10,
    },
  ];
  
  // Select appropriate number of questions
  const count = prompt.length > 100 ? 2 : 1;
  for (let i = 0; i < Math.min(count, templates.length); i++) {
    const markingScheme = generateMarkingSchemeForEssay(templates[i]);
    questions.push({
      type: 'essay',
      questionText: templates[i].questionText,
      options: [],
      correctAnswer: '',
      points: templates[i].points,
      markingScheme: markingScheme,
    });
  }
  
  return questions;
}

function generateMarkingSchemeForEssay(template) {
  const totalPoints = template.points;
  return `Marking Scheme (Total: ${totalPoints} marks):\n\n` +
    `a) Definition and core components (${Math.ceil(totalPoints * 0.3)} marks):\n` +
    `   - Clear, accurate definition: ${Math.ceil(totalPoints * 0.15)} marks\n` +
    `   - Comprehensive explanation of components: ${Math.ceil(totalPoints * 0.15)} marks\n\n` +
    `b) Analysis and factors (${Math.ceil(totalPoints * 0.4)} marks):\n` +
    `   - Identification of key factors: ${Math.ceil(totalPoints * 0.2)} marks\n` +
    `   - Quality of analysis and reasoning: ${Math.ceil(totalPoints * 0.2)} marks\n\n` +
    `c) Evaluation and synthesis (${Math.ceil(totalPoints * 0.3)} marks):\n` +
    `   - Critical evaluation: ${Math.ceil(totalPoints * 0.15)} marks\n` +
    `   - Well-reasoned conclusions: ${Math.ceil(totalPoints * 0.15)} marks\n\n` +
    `General Guidelines:\n` +
    `- Full marks: Complete, accurate, well-structured answer with clear examples\n` +
    `- Half marks: Partially correct with some key points addressed\n` +
    `- Quarter marks: Attempt made but lacks depth and clarity\n` +
    `- Zero marks: No attempt or completely off-topic\n`;
}

export async function POST(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const body = await request.json();
    const { prompt, format } = body;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide a topic or prompt for question generation' },
        { status: 400 }
      );
    }

    if (prompt.length < 5) {
      return NextResponse.json(
        { error: 'Please provide a more detailed topic description (at least 5 characters)' },
        { status: 400 }
      );
    }

    // Generate questions based on the prompt
    const finalFormat = format || exam.format;
    const generatedQuestions = generateQuestionsFromPrompt(prompt, finalFormat);

    if (generatedQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Could not generate questions from the provided prompt. Please try a more specific topic.' },
        { status: 400 }
      );
    }

    // Save generated questions to database
    const createdQuestions = [];
    for (const q of generatedQuestions) {
      const question = await Question.create({
        examId: params.id,
        type: q.type,
        questionText: q.questionText,
        options: q.type === 'mcq' ? q.options : [],
        correctAnswer: q.type === 'mcq' ? q.correctAnswer : '',
        markingScheme: q.type === 'essay' ? q.markingScheme : '',
        points: q.points,
      });

      createdQuestions.push({
        _id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        markingScheme: question.markingScheme,
        points: question.points,
      });
    }

    const mcqCount = generatedQuestions.filter(q => q.type === 'mcq').length;
    const essayCount = generatedQuestions.filter(q => q.type === 'essay').length;
    let summary = `Successfully generated ${createdQuestions.length} questions`;
    if (mcqCount > 0) summary += ` (${mcqCount} MCQ`;
    if (essayCount > 0) summary += `${mcqCount > 0 ? ', ' : ' ('}${essayCount} Essay`;
    if (mcqCount > 0 || essayCount > 0) summary += ')';

    return NextResponse.json({
      message: summary,
      questions: createdQuestions,
      generateInfo: {
        totalGenerated: createdQuestions.length,
        mcqCount,
        essayCount,
        prompt: prompt.substring(0, 100),
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}