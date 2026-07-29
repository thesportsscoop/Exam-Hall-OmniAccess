import mongoose from 'mongoose';

const proctoringEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'face_missing',
        'multiple_faces',
        'gaze_away',
        'speaking_detected',
        'phone_detected',
        'object_detected',
        'tab_switch',
        'environment_scan_complete',
        'identity_verified',
        'identity_failed',
        'session_started',
        'session_ended',
      ],
      required: [true, 'Event type is required'],
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'violation'],
      default: 'info',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      trim: true,
      default: '',
    },
    snapshotUrl: {
      type: String,
      trim: true,
      default: '',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false }
);

const proctoringSessionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam ID is required'],
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission ID is required'],
      index: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'flagged', 'rejected'],
      default: 'pending',
    },
    identityVerification: {
      idPhotoUrl: { type: String, default: '' },
      selfieUrl: { type: String, default: '' },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      confidence: { type: Number, default: 0 },
    },
    environmentScan: {
      completed: { type: Boolean, default: false },
      scanUrl: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    events: [proctoringEventSchema],
    violationCount: {
      type: Number,
      default: 0,
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    recordingUrl: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
proctoringSessionSchema.index({ examId: 1, studentName: 1 });

const ProctoringSession =
  mongoose.models.ProctoringSession ||
  mongoose.model('ProctoringSession', proctoringSessionSchema);

export default ProctoringSession;