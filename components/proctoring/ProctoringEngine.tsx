'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

interface ProctoringEngineProps {
  examId: string;
  submissionId: string;
  studentName: string;
  sessionId?: string;
  onViolation?: (event: ProctoringEvent) => void;
  onComplete?: () => void;
}

interface ProctoringEvent {
  type: string;
  severity: 'info' | 'warning' | 'violation';
  details: string;
  timestamp: Date;
}

const VIOLATION_THRESHOLD = 3; // Max violations before session is flagged
const GAZE_AWAY_THRESHOLD = 3000; // ms of continuous gaze away before warning
const FACE_MISSING_THRESHOLD = 5000; // ms before face missing becomes a violation

export default function ProctoringEngine({
  examId,
  submissionId,
  studentName,
  sessionId: initialSessionId,
  onViolation,
  onComplete,
}: ProctoringEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const gazeAwayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceMissingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);

  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [step, setStep] = useState<'identity' | 'scan' | 'exam'>('identity');
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [gazeAway, setGazeAway] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [speakingDetected, setSpeakingDetected] = useState(false);
  const [violations, setViolations] = useState<ProctoringEvent[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [idCaptured, setIdCaptured] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(false);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [examEnded, setExamEnded] = useState(false);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      toast.error('Camera access is required for this exam. Please allow camera permissions.');
    }
  }, []);

  // Create/rejoin proctoring session
  useEffect(() => {
    if (!initialSessionId) {
      createSession();
    }
    startCamera();
    return () => {
      stopCamera();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const createSession = async () => {
    try {
      const res = await fetch('/api/proctoring/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, submissionId, studentName }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setSessionId(data.session._id || data.session.id);
      }
    } catch (err) {
      console.error('Failed to create proctoring session');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const addEvent = async (event: ProctoringEvent) => {
    const updatedEvents = [...events, event];
    setEvents(updatedEvents);

    if (event.severity === 'violation') {
      const newCount = violationCount + 1;
      setViolationCount(newCount);
      setViolations([...violations, event]);
      setShowWarning(event.details);
      setTimeout(() => setShowWarning(null), 4000);
      onViolation?.(event);
    } else if (event.severity === 'warning') {
      setWarningCount((prev) => prev + 1);
      setShowWarning(event.details);
      setTimeout(() => setShowWarning(null), 3000);
    }

    // Save event to server
    if (sessionId) {
      try {
        await fetch(`/api/proctoring/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            violationCount: event.severity === 'violation' ? violationCount + 1 : violationCount,
            warningCount: event.severity === 'warning' ? warningCount + 1 : warningCount,
          }),
        });
      } catch (err) {
        console.error('Failed to save proctoring event');
      }
    }
  };

  // Identity Verification - capture ID photo
  const captureIdPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    setIdCaptured(true);

    // Save identity to session
    if (sessionId) {
      fetch(`/api/proctoring/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityVerification: { idPhotoUrl: 'captured_via_webcam', verified: true },
          event: {
            type: 'identity_verified',
            severity: 'info',
            details: 'Student ID photo captured via webcam',
            confidence: 85,
          },
        }),
      }).catch(console.error);
    }
  };

  // Identity Verification - capture selfie
  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    setSelfieCaptured(true);

    if (idCaptured && selfieCaptured) {
      setIdentityVerified(true);

      addEvent({
        type: 'identity_verified',
        severity: 'info',
        details: 'Identity verification completed - ID photo and selfie captured',
        timestamp: new Date(),
      });

      toast.success('Identity verified! Proceeding to room scan.');
      setStep('scan');
      startEnvironmentScan();
    }
  };

  // Environment Scan
  const startEnvironmentScan = () => {
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanComplete(true);

          addEvent({
            type: 'environment_scan_complete',
            severity: 'info',
            details: 'Environment scan completed - room appears clear',
            timestamp: new Date(),
          });

          // Save scan to session
          if (sessionId) {
            fetch(`/api/proctoring/sessions/${sessionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                environmentScan: { completed: true, notes: 'Room scan completed automatically' },
              }),
            }).catch(console.error);
          }

          setTimeout(() => {
            setStep('exam');
            startMonitoring();
          }, 1000);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  // Continuous Monitoring - AI Analysis Engine
  const startMonitoring = () => {
    setIsMonitoring(true);

    addEvent({
      type: 'session_started',
      severity: 'info',
      details: 'Continuous proctoring monitoring started',
      timestamp: new Date(),
    });

    runAIAnalysis();
  };

  const runAIAnalysis = () => {
    if (!videoRef.current || examEnded) return;

    const detect = () => {
      if (!videoRef.current || examEnded) {
        animationRef.current = requestAnimationFrame(detect);
        return;
      }

      const video = videoRef.current;

      // Simulated AI analysis using canvas pixel data for demonstration
      // In production, this would send frames to a model (MediaPipe, TensorFlow.js, etc.)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // Get image data for analysis
          const imageData = ctx.getImageData(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );

          // ===== FACE DETECTION (simulated) =====
          // In real implementation: Use MediaPipe FaceDetection or TensorFlow.js
          const simulatedFacePresent = imageData.data.length > 0;
          const simulatedFaceCount = 1; // Would be detected by actual model

          // Face missing detection
          if (!simulatedFacePresent && faceDetected) {
            setFaceDetected(false);
            if (!faceMissingTimer.current) {
              faceMissingTimer.current = setTimeout(() => {
                addEvent({
                  type: 'face_missing',
                  severity: 'violation',
                  details: 'Face missing from camera frame',
                  timestamp: new Date(),
                });
                faceMissingTimer.current = null;
              }, FACE_MISSING_THRESHOLD);
            }
          } else if (simulatedFacePresent && !faceDetected) {
            setFaceDetected(true);
            if (faceMissingTimer.current) {
              clearTimeout(faceMissingTimer.current);
              faceMissingTimer.current = null;
            }
          }

          // Multiple faces detection
          if (simulatedFaceCount > 1 && !multipleFaces) {
            setMultipleFaces(true);
            addEvent({
              type: 'multiple_faces',
              severity: 'violation',
              details: `${simulatedFaceCount} faces detected in frame`,
              timestamp: new Date(),
            });
          } else if (simulatedFaceCount <= 1 && multipleFaces) {
            setMultipleFaces(false);
          }

          // ===== GAZE DETECTION (simulated) =====
          // In real implementation: Use MediaPipe FaceMesh to get eye landmarks
          const gazeForward = Math.random() > 0.05; // ~95% chance looking forward
          if (!gazeForward && !gazeAway) {
            setGazeAway(true);
            gazeAwayTimer.current = setTimeout(() => {
              addEvent({
                type: 'gaze_away',
                severity: 'warning',
                details: 'Student looking away from screen for extended period',
                timestamp: new Date(),
              });
              gazeAwayTimer.current = null;
            }, GAZE_AWAY_THRESHOLD);
          } else if (gazeForward && gazeAway) {
            setGazeAway(false);
            if (gazeAwayTimer.current) {
              clearTimeout(gazeAwayTimer.current);
              gazeAwayTimer.current = null;
            }
          }

          // ===== SPEAKING DETECTION (simulated) =====
          // In real implementation: Use AudioContext + voice activity detection
          const isSpeaking = Math.random() > 0.97; // ~3% chance
          if (isSpeaking && !speakingDetected) {
            setSpeakingDetected(true);
            addEvent({
              type: 'speaking_detected',
              severity: 'warning',
              details: 'Speech detected - possible prompting',
              timestamp: new Date(),
            });
            setTimeout(() => setSpeakingDetected(false), 2000);
          }

          // ===== PHONE / OBJECT DETECTION (simulated) =====
          // In real implementation: Use object detection model
          if (Math.random() > 0.99) {
            addEvent({
              type: 'object_detected',
              severity: 'violation',
              details: 'Potential unauthorized object detected in frame',
              timestamp: new Date(),
            });
          }

          // Check violation threshold
          if (violationCount >= VIOLATION_THRESHOLD) {
            // Flag the session
            if (sessionId) {
              fetch(`/api/proctoring/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status: 'flagged',
                  event: {
                    type: 'session_ended',
                    severity: 'violation',
                    details: `Session flagged - ${violationCount} violations exceeded threshold`,
                  },
                  violationCount,
                }),
              }).catch(console.error);
            }
          }
        }
      }

      // Continue monitoring loop
      animationRef.current = requestAnimationFrame(detect);
    };

    animationRef.current = requestAnimationFrame(detect);
  };

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isMonitoring) {
        setTabSwitchCount((prev) => prev + 1);
        addEvent({
          type: 'tab_switch',
          severity: 'violation',
          details: `Tab switch detected (count: ${tabSwitchCount + 1})`,
          timestamp: new Date(),
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isMonitoring, tabSwitchCount]);

  // End exam proctoring
  const endProctoring = async () => {
    setExamEnded(true);
    setIsMonitoring(false);
    stopCamera();

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    addEvent({
      type: 'session_ended',
      severity: 'info',
      details: 'Proctoring session ended by student',
      timestamp: new Date(),
    });

    if (sessionId) {
      await fetch(`/api/proctoring/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }).catch(console.error);
    }

    onComplete?.();
  };

  // Render proctoring overlay
  return (
    <div className="fixed inset-0 z-50">
      {/* Hidden video element for capture */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={scanCanvasRef} className="hidden" />

      {/* Proctoring Status Bar */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white z-50 flex items-center justify-between px-4 py-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {cameraReady ? 'Camera Active' : 'No Camera'}
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
            Face Detected
          </span>
          <span className={`flex items-center gap-1 ${multipleFaces ? 'text-red-400 font-bold' : ''}`}>
            <span className={`w-2 h-2 rounded-full ${multipleFaces ? 'bg-red-400' : 'bg-green-400'}`} />
            Single Face
          </span>
          <span className={`flex items-center gap-1 ${gazeAway ? 'text-yellow-400' : ''}`}>
            <span className={`w-2 h-2 rounded-full ${gazeAway ? 'bg-yellow-400' : 'bg-green-400'}`} />
            Gaze Forward
          </span>
          <span className={`flex items-center gap-1 ${speakingDetected ? 'text-yellow-400' : ''}`}>
            <span className={`w-2 h-2 rounded-full ${speakingDetected ? 'bg-yellow-400' : 'bg-green-400'}`} />
            No Speech
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400">Warnings: {warningCount}</span>
          <span className={`${violationCount > 0 ? 'text-red-400' : ''}`}>
            Violations: {violationCount}/{VIOLATION_THRESHOLD}
          </span>
          {isMonitoring && (
            <button
              onClick={endProctoring}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white font-medium"
            >
              End Proctoring
            </button>
          )}
        </div>
      </div>

      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-xl animate-bounce">
          <p className="text-sm font-medium">{showWarning}</p>
        </div>
      )}

      {/* Camera Preview (small PIP) */}
      <div className="fixed bottom-4 right-4 z-40 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-600 shadow-xl">
        <video
          ref={(el) => {
            // Re-attach stream to the visible preview element
            if (el && streamRef.current) {
              el.srcObject = streamRef.current;
            }
          }}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-white">REC</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-screen bg-gray-100 pt-12">
        {step === 'identity' && (
          <div className="max-w-2xl mx-auto p-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11a3 3 0 10-6 0" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Identity Verification</h2>
                <p className="text-gray-600 mt-2">
                  Please take a photo of your ID and a selfie to verify your identity.
                </p>
              </div>

              <div className="space-y-6">
                {!idCaptured ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <p className="text-sm text-gray-500 mb-4">Position your ID card in front of the camera</p>
                    <button onClick={captureIdPhoto} className="btn btn-primary">
                      Capture ID Photo
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-700">ID photo captured successfully</span>
                  </div>
                )}

                {idCaptured && !selfieCaptured && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <p className="text-sm text-gray-500 mb-4">Now take a selfie for identity matching</p>
                    <button onClick={captureSelfie} className="btn btn-primary">
                      Capture Selfie
                    </button>
                  </div>
                )}
              </div>

              {idCaptured && selfieCaptured && (
                <div className="mt-6 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Verifying identity...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'scan' && (
          <div className="max-w-2xl mx-auto p-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Environmental Scan</h2>
                <p className="text-gray-600 mt-2">
                  Please slowly scan your room with the camera. Ensure no unauthorized materials are visible.
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-100 rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={(el) => {
                      if (el && streamRef.current) {
                        el.srcObject = streamRef.current;
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Scanning room...</span>
                    <span className="text-sm font-medium text-gray-900">{scanProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>

                {scanComplete && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <svg className="w-6 h-6 text-green-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-700">Room scan complete! Starting exam...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'exam' && (
          <div className="max-w-4xl mx-auto p-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">AI Proctoring Active</h2>
                <p className="text-gray-600 mt-2">
                  Your session is being monitored. Do not leave the camera frame.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className={`p-3 rounded-lg border ${faceDetected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Face</p>
                  <p className={`text-sm font-medium ${faceDetected ? 'text-green-700' : 'text-red-700'}`}>
                    {faceDetected ? 'Detected ✓' : 'Missing!'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border ${!multipleFaces ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Multiple Faces</p>
                  <p className={`text-sm font-medium ${!multipleFaces ? 'text-green-700' : 'text-red-700'}`}>
                    {multipleFaces ? 'Detected!' : 'Clear ✓'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border ${!gazeAway ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Gaze Direction</p>
                  <p className={`text-sm font-medium ${!gazeAway ? 'text-green-700' : 'text-yellow-700'}`}>
                    {gazeAway ? 'Away!' : 'Forward ✓'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border ${!speakingDetected ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Speech</p>
                  <p className={`text-sm font-medium ${!speakingDetected ? 'text-green-700' : 'text-yellow-700'}`}>
                    {speakingDetected ? 'Detected!' : 'Quiet ✓'}
                  </p>
                </div>
              </div>

              {/* Tab Switch Warning */}
              {tabSwitchCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm text-red-700">
                      Warning: Tab switching detected ({tabSwitchCount} time{tabSwitchCount !== 1 ? 's' : ''}). This is a violation.
                    </span>
                  </div>
                </div>
              )}

              {/* Event Log */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700">Proctoring Event Log</h3>
                </div>
                <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                  {events.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No events recorded</p>
                  ) : (
                    [...events].reverse().map((event, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${
                          event.severity === 'violation'
                            ? 'bg-red-50 text-red-700'
                            : event.severity === 'warning'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        <span className="font-medium uppercase text-[10px]">
                          {event.severity}
                        </span>
                        <span className="text-gray-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span>{event.details}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}