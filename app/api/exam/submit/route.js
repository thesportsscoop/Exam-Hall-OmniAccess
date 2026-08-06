import { NextResponse } from 'next/server';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import Submission from '@/models/Submission';
import dbConnect from '@/lib/mongodb';

// Essay scoring algorithm with keyword matching and partial credit
function scoreEssay(answer, markingScheme, maxPoints) {
  if (!answer || !answer.trim()) {
    return { points: 0, matchedKeywords: [], feedback: 'No answer provided' };
  }

  // Parse marking scheme for keywords and point values
  // Expected format: "keyword1: 2pts, keyword2: 1pt, keyword3: 2pts"
  // Or simple keywords separated by commas
  const keywords = [];
  const schemeParts = markingScheme.split(/[,;\n]/);
  
  for (const part of schemeParts) {
    const match = part.match(/(.+?):\s*(\d+)\s*pts?/i);
    if (match) {
      keywords.push({ term: match[1].trim().toLowerCase(), points: parseInt(match[2]) });
    } else if (part.trim()) {
      // Simple keyword without points - assign 1 point each
      keywords.push({ term: part.trim().toLowerCase(), points: 1 });
    }
  }

  // If no keywords parsed, use basic word count scoring
  if (keywords.length === 0) {
    const wordCount = answer.trim().split(/\s+/).length;
    if (wordCount >= 50) return { points: maxPoints, matchedKeywords: [], feedback: 'Comprehensive answer' };
    if (wordCount >= 20) return { points: Math.round(maxPoints * 0.6), matchedKeywords: [], feedback: 'Adequate answer' };
    if (wordCount >= 5) return { points: Math.round(maxPoints * 0.3), matchedKeywords: [], feedback: 'Brief answer' };
    return { points: 0, matchedKeywords: [], feedback: 'Insufficient answer' };
  }

  const answerLower = answer.toLowerCase();
  const matchedKeywords = [];
  let totalEarned = 0;
  let maxPossible = 0;

  for (const kw of keywords) {
    maxPossible += kw.points;
    // Check for keyword match (partial word matching)
    if (answerLower.includes(kw.term)) {
      matchedKeywords.push(kw.term);
      totalEarned += kw.points;
    }
  }

  // Cap at maxPoints
  const finalPoints = Math.min(totalEarned, maxPoints);
  const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;

  let feedback = '';
  if (percentage >= 80) feedback = 'Excellent - covered most key points';
  else if (percentage >= 60) feedback = 'Good - covered main points';
  else if (percentage >= 40) feedback = 'Fair - some key points missing';
  else if (percentage > 0) feedback = 'Needs improvement - key points missing';
  else feedback = 'No key points identified';

  return { points: finalPoints, matchedKeywords, feedback };
}

// Short answer scoring - simpler keyword matching
function scoreShortAnswer(answer, markingScheme, maxPoints) {
  if (!answer || !answer.trim()) {
    return { points: 0, matchedKeywords: [], feedback: 'No answer provided' };
  }

  // Parse marking scheme for keywords
  const keywords = [];
  const schemeParts = markingScheme.split(/[,;\n]/);
  
  for (const part of schemeParts) {
    const match = part.match(/(.+?):\s*(\d+)\s*pts?/i);
    if (match) {
      keywords.push({ term: match[1].trim().toLowerCase(), points: parseInt(match[2]) });
    } else if (part.trim()) {
      keywords.push({ term: part.trim().toLowerCase(), points: 1 });
    }
  }

  // If no keywords parsed, use word count scoring
  if (keywords.length === 0) {
    const wordCount = answer.trim().split(/\s+/).length;
    if (wordCount >= 10) return { points: maxPoints, matchedKeywords: [], feedback: 'Good answer' };
    if (wordCount >= 3) return { points: Math.round(maxPoints * 0.5), matchedKeywords: [], feedback: 'Brief answer' };
    return { points: 0, matchedKeywords: [], feedback: 'Insufficient answer' };
  }

  const answerLower = answer.toLowerCase();
  const matchedKeywords = [];
  let totalEarned = 0;
  let maxPossible = 0;

  for (const kw of keywords) {
    maxPossible += kw.points;
    if (answerLower.includes(kw.term)) {
      matchedKeywords.push(kw.term);
      totalEarned += kw.points;
    }
  }

  const finalPoints = Math.min(totalEarned, maxPoints);
  const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;

  let feedback = '';
  if (percentage >= 80) feedback = 'Excellent - covered most key points';
  else if (percentage >= 60) feedback = 'Good - covered main points';
  else if (percentage >= 40) feedback = 'Fair - some key points missing';
  else if (percentage > 0) feedback = 'Needs improvement - key points missing';
  else feedback = 'No key points identified';

  return { points: finalPoints, matchedKeywords, feedback };
}

// Fill blank scoring - case-insensitive exact match
function scoreFillBlank(answer, correctAnswer, maxPoints) {
  if (!answer || !answer.trim()) {
    return { points: 0, isCorrect: false, feedback: 'No answer provided' };
  }

  const isCorrect = answer.trim().toLowerCase() === (correctAnswer || '').trim().toLowerCase();
  return {
    points: isCorrect ? maxPoints : 0,
    isCorrect,
    feedback: isCorrect ? 'Correct' : 'Incorrect',
  };
}

export async function POST(request) {
  try {
    await dbConnect();
    const { examId, surname, firstName, className, answers } = await request.json();

    if (!examId || !surname || !firstName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const questions = await Question.find({ examId: exam._id }).sort({ createdAt: 1 });
    let score = 0;
    let maxScore = 0;
    const gradedAnswers = [];
    const breakdown = [];

    for (const q of questions) {
      maxScore += q.points;
      const studentAnswer = answers.find(a => a.questionId === q._id.toString());
      const answerText = studentAnswer ? studentAnswer.answer : '';

      if (q.type === 'mcq') {
        // MCQ: Instant automated comparison
        const isCorrect = answerText === q.correctAnswer;
        const pointsAwarded = isCorrect ? q.points : 0;
        if (isCorrect) score += q.points;

        gradedAnswers.push({
          questionId: q._id,
          answer: answerText,
          isCorrect,
          pointsAwarded,
          feedback: isCorrect ? 'Correct' : 'Incorrect',
        });

        breakdown.push({
          questionId: q._id,
          type: 'mcq',
          questionText: q.questionText,
          studentAnswer: answerText,
          correctAnswer: q.correctAnswer,
          isCorrect,
          pointsAwarded,
          maxPoints: q.points,
        });
      } else if (q.type === 'true_false') {
        // True/False: Compare to correct answer (True/False)
        const isCorrect = answerText.toLowerCase() === (q.correctAnswer || '').toLowerCase();
        const pointsAwarded = isCorrect ? q.points : 0;
        if (isCorrect) score += q.points;

        gradedAnswers.push({
          questionId: q._id,
          answer: answerText,
          isCorrect,
          pointsAwarded,
          feedback: isCorrect ? 'Correct' : 'Incorrect',
        });

        breakdown.push({
          questionId: q._id,
          type: 'true_false',
          questionText: q.questionText,
          studentAnswer: answerText,
          correctAnswer: q.correctAnswer,
          isCorrect,
          pointsAwarded,
          maxPoints: q.points,
        });
      } else if (q.type === 'fill_blank') {
        // Fill in the blank: Case-insensitive exact match
        const result = scoreFillBlank(answerText, q.correctAnswer, q.points);
        score += result.points;

        gradedAnswers.push({
          questionId: q._id,
          answer: answerText,
          isCorrect: result.isCorrect,
          pointsAwarded: result.points,
          feedback: result.feedback,
        });

        breakdown.push({
          questionId: q._id,
          type: 'fill_blank',
          questionText: q.questionText,
          studentAnswer: answerText,
          correctAnswer: q.correctAnswer,
          isCorrect: result.isCorrect,
          pointsAwarded: result.points,
          maxPoints: q.points,
        });
      } else if (q.type === 'short_answer') {
        // Short answer: Keyword matching with simpler scoring
        const result = scoreShortAnswer(answerText, q.markingScheme, q.points);
        score += result.points;

        gradedAnswers.push({
          questionId: q._id,
          answer: answerText,
          isCorrect: null,
          pointsAwarded: result.points,
          feedback: result.feedback,
          matchedKeywords: result.matchedKeywords,
        });

        breakdown.push({
          questionId: q._id,
          type: 'short_answer',
          questionText: q.questionText,
          studentAnswer: answerText,
          markingScheme: q.markingScheme,
          pointsAwarded: result.points,
          maxPoints: q.points,
          matchedKeywords: result.matchedKeywords,
          feedback: result.feedback,
        });
      } else {
        // Essay/Hybrid: Keyword-matching and partial-credit algorithm
        const result = scoreEssay(answerText, q.markingScheme, q.points);
        score += result.points;

        gradedAnswers.push({
          questionId: q._id,
          answer: answerText,
          isCorrect: null,
          pointsAwarded: result.points,
          feedback: result.feedback,
          matchedKeywords: result.matchedKeywords,
        });

        breakdown.push({
          questionId: q._id,
          type: 'essay',
          questionText: q.questionText,
          studentAnswer: answerText,
          markingScheme: q.markingScheme,
          pointsAwarded: result.points,
          maxPoints: q.points,
          matchedKeywords: result.matchedKeywords,
          feedback: result.feedback,
        });
      }
    }

    const studentName = `${surname} ${firstName}`;
    const allMcq = questions.every(q => q.type === 'mcq');

    let submission;
    try {
      submission = await Submission.create({
        examId: exam._id,
        studentName,
        classGroup: className || '',
        answers: gradedAnswers,
        score,
        maxScore,
        isGraded: true, // Auto-graded by the engine
      });
    } catch (createError) {
      if (createError.code === 11000) {
        return NextResponse.json({ error: 'You have already submitted this exam.' }, { status: 403 });
      }
      throw createError;
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    const response = {
      submissionId: submission._id,
      score,
      maxScore,
      percentage,
      studentName,
    };

    // Only include detailed breakdown if showResults is enabled
    if (exam.showResults) {
      response.breakdown = breakdown;
      response.showResults = true;
    } else {
      response.showResults = false;
      response.message = 'Your exam has been submitted. Results will be available later.';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error submitting exam:', error);
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 });
  }
}