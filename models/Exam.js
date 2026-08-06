import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide an exam title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    academicYear: {
      type: String,
      trim: true,
      default: '',
    },
    term: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Please provide exam duration'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [480, 'Duration cannot exceed 480 minutes (8 hours)'],
    },
    startTime: {
      type: Date,
      required: [true, 'Please provide exam start time'],
    },
    endTime: {
      type: Date,
      required: [true, 'Please provide exam end time'],
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    passkey: {
      type: String,
      required: [true, 'Please provide a passkey'],
      trim: true,
      minlength: [4, 'Passkey must be at least 4 characters'],
    },
    format: {
      type: String,
      enum: ['mcq', 'essay', 'hybrid'],
      default: 'mcq',
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    showResults: {
      type: Boolean,
      default: false,
    },
    classes: [
      {
        type: String,
        trim: true,
      },
    ],
    isPaid: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    draftQuestions: [{ type: Object }],
    draftSavedAt: Date,

    // Step 2: Availability settings
    availabilityType: {
      type: String,
      enum: ['anytime', 'scheduled'],
      default: 'anytime',
    },
    lateSubmissionPolicy: {
      type: String,
      enum: ['reject', 'accept_penalty', 'accept'],
      default: 'reject',
    },

    // Step 3: Access & Security settings
    maxAttempts: {
      type: Number,
      default: 1,
      min: [1, 'Max attempts must be at least 1'],
      max: [10, 'Max attempts cannot exceed 10'],
    },
    oneDeviceOnly: {
      type: Boolean,
      default: false,
    },
    randomizeQuestions: {
      type: Boolean,
      default: false,
    },
    randomizeOptions: {
      type: Boolean,
      default: false,
    },
    shuffleStudents: {
      type: Boolean,
      default: false,
    },
    showTimer: {
      type: Boolean,
      default: true,
    },
    autoSubmit: {
      type: Boolean,
      default: true,
    },
    preventCopyPaste: {
      type: Boolean,
      default: true,
    },
    requireFullscreen: {
      type: Boolean,
      default: true,
    },

    // Step 4: Results settings
    showScoreImmediately: {
      type: Boolean,
      default: false,
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false,
    },
    showExplanations: {
      type: Boolean,
      default: false,
    },
    hideResults: {
      type: Boolean,
      default: true,
    },
    releaseResultsLater: {
      type: Boolean,
      default: false,
    },
    releaseDate: {
      type: Date,
      default: null,
    },
    certificateAfterCompletion: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
examSchema.index({ teacherId: 1, createdAt: -1 });
examSchema.index({ passkey: 1 }, { unique: true });

const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);

export default Exam;