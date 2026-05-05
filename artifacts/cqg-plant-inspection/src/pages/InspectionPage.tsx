import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { useGps } from '@/context/GpsContext';
import { useOfflineSync } from '@/context/OfflineSyncContext';
import CreateWorkOrderModal from '@/components/CreateWorkOrderModal';

type AnswerResult = 'PASS' | 'FAIL' | 'MONITOR' | 'NA';

interface Question {
  id: string;
  text: string;
  order: number;
  helpText: string | null;
  allowMonitor: boolean;
  requiresEvidenceOnFail: boolean;
}

interface Section {
  id: string;
  title: string;
  order: number;
  questions: Question[];
}

interface Inspection {
  id: string;
  status: string;
  overallResult: string | null;
  asset: { id: string; name: string; plantId: string | null } | null;
  site: { id: string; name: string; code: string };
  template: { name: string; type: string; sections: Section[] };
  answers: Array<{ id: string; questionId: string; result: string; notes: string | null }>;
  workOrders: Array<{ id: string; title: string; status: string }>;
}

export default function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { position } = useGps();

  const { isOnline, queueAnswer } = useOfflineSync();
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { result: AnswerResult; notes: string; queued?: boolean }>>({});
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);

  const { data: inspection, isLoading } = useQuery<Inspection>({
    queryKey: ['inspection', id],
    queryFn: () => api.get(`/inspections/${id}`).then((r) => r.data),
    refetchInterval: false,
    staleTime: 10 * 60 * 1000,
  });

  // Cache inspection data in SW when loaded
  useEffect(() => {
    if (!inspection) return;
    navigator.serviceWorker?.controller?.postMessage({
      type: 'CACHE_INSPECTION',
      inspection: { ...inspection, id },
    });
  }, [inspection, id]);

  useEffect(() => {
    if (inspection?.answers) {
      const existing: Record<string, { result: AnswerResult; notes: string }> = {};
      for (const a of inspection.answers) {
        existing[a.questionId] = { result: a.result as AnswerResult, notes: a.notes || '' };
      }
      setAnswers(existing);
    }
  }, [inspection]);

  const submitAnswer = async (questionId: string, result: AnswerResult, notes: string) => {
    setSavingAnswer(questionId);
    const body = {
      answers: [{
        questionId,
        result,
        notes,
        locationLat: position?.lat ?? null,
        locationLng: position?.lng ?? null,
      }],
    };

    if (!isOnline) {
      const token = localStorage.getItem('cqg_plant_token');
      queueAnswer({
        url: `/api/inspections/${id}/answers`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        inspectionId: id!,
      });
      setAnswers((prev) => ({ ...prev, [questionId]: { result, notes, queued: true } }));
      setSavingAnswer(null);
      return;
    }

    try {
      await api.put(`/inspections/${id}/answers`, body);
      queryClient.invalidateQueries({ queryKey: ['inspection', id] });
    } catch {
      const token = localStorage.getItem('cqg_plant_token');
      queueAnswer({
        url: `/api/inspections/${id}/answers`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        inspectionId: id!,
      });
      setAnswers((prev) => ({ ...prev, [questionId]: { result, notes, queued: true } }));
    } finally {
      setSavingAnswer(null);
    }
  };

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/inspections/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection', id] });
      navigate('/');
    },
  });

  if (isLoading || !inspection) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading inspection...</div>
        </div>
      </AppShell>
    );
  }

  const sections = inspection.template.sections;
  const currentSection = sections[currentSectionIdx];
  const totalQuestions = sections.flatMap((s) => s.questions).length;
  const answeredCount = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const allAnswered = totalQuestions > 0 && answeredCount >= totalQuestions;
  const isCompleted = inspection.status === 'COMPLETED';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-4 py-4 bg-white border-b border-[#e0e0e0] sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-semibold text-[#1a1a1a] text-lg leading-tight">{inspection.template.name}</h1>
              <p className="text-xs text-gray-500">
                {inspection.asset?.name || inspection.site.name} &middot; {inspection.site.code}
              </p>
            </div>
            {isCompleted && inspection.overallResult && (
              <StatusBadge status={inspection.overallResult} size="md" />
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#297e49] h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">{answeredCount} / {totalQuestions} answered</div>
        </div>

        {isCompleted ? (
          <CompletedView
            inspection={inspection}
            siteId={inspection.site.id}
            assetId={inspection.asset?.id || null}
          />
        ) : (
          <div className="px-4 py-4">
            {/* Section tabs */}
            {sections.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {sections.map((sec, idx) => {
                  const sectionAnswered = sec.questions.filter((q) => answers[q.id]).length;
                  const sectionTotal = sec.questions.length;
                  const sectionComplete = sectionAnswered >= sectionTotal && sectionTotal > 0;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setCurrentSectionIdx(idx)}
                      className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap min-h-0 ${
                        idx === currentSectionIdx
                          ? 'bg-[#1a1a1a] text-white'
                          : sectionComplete
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sectionComplete ? '✓ ' : ''}{sec.title}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current section */}
            <h2 className="text-base font-semibold text-[#1a1a1a] mb-4">{currentSection.title}</h2>

            <div className="space-y-6">
              {currentSection.questions.map((question) => {
                const currentAnswer = answers[question.id];
                const isSaving = savingAnswer === question.id;

                return (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    inspectionId={id!}
                    answerId={inspection.answers.find((a) => a.questionId === question.id)?.id}
                    siteId={inspection.site.id}
                    assetId={inspection.asset?.id || null}
                    currentAnswer={currentAnswer as { result: AnswerResult; notes: string; queued?: boolean } | undefined}
                    isSaving={isSaving}
                    gpsPosition={position}
                    onAnswer={async (result, notes) => {
                      setAnswers((prev) => ({ ...prev, [question.id]: { result, notes } }));
                      await submitAnswer(question.id, result, notes);
                    }}
                  />
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {currentSectionIdx > 0 && (
                <button
                  onClick={() => setCurrentSectionIdx(currentSectionIdx - 1)}
                  className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] rounded-xl py-4 font-medium transition-colors hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              {currentSectionIdx < sections.length - 1 ? (
                <button
                  onClick={() => setCurrentSectionIdx(currentSectionIdx + 1)}
                  className="flex-1 bg-[#1a1a1a] text-white rounded-xl py-4 font-medium transition-colors hover:bg-black"
                >
                  Next Section
                </button>
              ) : (
                <button
                  onClick={() => completeMutation.mutate()}
                  disabled={!allAnswered || completeMutation.isPending}
                  className="flex-1 bg-[#297e49] disabled:opacity-50 text-white rounded-xl py-4 font-semibold text-lg transition-colors hover:bg-[#1f6338]"
                >
                  {completeMutation.isPending ? 'Completing...' : 'Complete Inspection'}
                </button>
              )}
            </div>

            {!allAnswered && currentSectionIdx === sections.length - 1 && (
              <p className="text-center text-sm text-gray-500 mt-3">
                Answer all questions to complete
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface QuestionCardProps {
  question: Question;
  inspectionId: string;
  answerId: string | undefined;
  siteId: string;
  assetId: string | null;
  currentAnswer?: { result: AnswerResult; notes: string; queued?: boolean };
  isSaving: boolean;
  gpsPosition: GpsPosition | null;
  onAnswer: (result: AnswerResult, notes: string) => Promise<void>;
}

function QuestionCard({ question, inspectionId, answerId, siteId, assetId, currentAnswer, isSaving, gpsPosition, onAnswer }: QuestionCardProps) {
  const [notes, setNotes] = useState(currentAnswer?.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; previewUrl: string }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showWOModal, setShowWOModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buttons: { result: AnswerResult; label: string; colour: string }[] = [
    { result: 'PASS', label: 'PASS', colour: 'bg-[#297e49] border-[#297e49] text-white' },
    { result: 'FAIL', label: 'FAIL', colour: 'bg-[#dc2d2f] border-[#dc2d2f] text-white' },
    ...(question.allowMonitor ? [{ result: 'MONITOR' as AnswerResult, label: 'MONITOR', colour: 'bg-[#f59e0b] border-[#f59e0b] text-white' }] : []),
    { result: 'NA', label: 'N/A', colour: 'bg-[#9ca3af] border-[#9ca3af] text-white' },
  ];

  const handleAnswer = async (result: AnswerResult) => {
    if (result === 'FAIL' || result === 'MONITOR') {
      setShowNotes(true);
    }
    await onAnswer(result, notes);
    if (result === 'FAIL' || result === 'MONITOR') {
      setShowWOModal(true);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentAnswer) return;

    setUploadingPhoto(true);
    try {
      const inspRes = await api.get(`/inspections/${inspectionId}`);
      const answerRecord = inspRes.data.answers.find(
        (a: { questionId: string; id: string }) => a.questionId === question.id
      );

      if (!answerRecord) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('inspectionAnswerId', answerRecord.id);
      if (gpsPosition) {
        formData.append('lat', String(gpsPosition.lat));
        formData.append('lng', String(gpsPosition.lng));
        formData.append('capturedAt', new Date(gpsPosition.timestamp).toISOString());
      }
      formData.append('deviceInfo', navigator.userAgent.slice(0, 200));

      const res = await api.post('/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPhotos((prev) => [...prev, { id: res.data.id, previewUrl: res.data.previewUrl }]);
    } catch {
      // silent
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resultColour: Record<string, string> = {
    PASS: '#297e49',
    FAIL: '#dc2d2f',
    MONITOR: '#f59e0b',
    NA: '#9ca3af',
  };

  return (
    <div
      className="bg-white border-2 rounded-xl p-4 transition-colors"
      style={{ borderColor: currentAnswer ? resultColour[currentAnswer.result] : '#e0e0e0' }}
    >
      <p className="text-base font-medium text-[#1a1a1a] leading-snug mb-1">{question.text}</p>
      {question.helpText && (
        <p className="text-sm text-gray-500 mb-3">{question.helpText}</p>
      )}

      {isSaving && <p className="text-xs text-gray-400 mb-2">Saving...</p>}
      {!isSaving && currentAnswer?.queued && (
        <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          Queued — will sync when online
        </p>
      )}

      {/* Answer buttons */}
      <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-4">
        {buttons.map(({ result, label, colour }) => (
          <button
            key={result}
            onClick={() => handleAnswer(result)}
            className={`py-4 rounded-xl text-sm font-bold border-2 transition-all min-h-[56px] ${
              currentAnswer?.result === result
                ? colour
                : 'bg-white border-[#e0e0e0] text-gray-600 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Manual Raise WO button */}
      {(currentAnswer?.result === 'FAIL' || currentAnswer?.result === 'MONITOR') && (
        <div className="mt-2">
          <button
            onClick={() => setShowWOModal(true)}
            className={`text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors min-h-0 min-w-0 ${
              currentAnswer.result === 'FAIL'
                ? 'text-red-700 border-red-300 bg-red-50 hover:bg-red-100'
                : 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            + Raise Work Order
          </button>
        </div>
      )}

      {/* Notes */}
      {(showNotes || currentAnswer?.notes) && (
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => currentAnswer && onAnswer(currentAnswer.result, notes)}
            placeholder="Add notes (optional)..."
            rows={2}
            className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#dc2d2f]"
          />
        </div>
      )}

      {!showNotes && !currentAnswer?.notes && currentAnswer && (
        <button
          onClick={() => setShowNotes(true)}
          className="text-xs text-gray-400 mt-2 hover:text-gray-600 min-h-0 min-w-0"
        >
          + Add note
        </button>
      )}

      {/* Photo capture */}
      {currentAnswer && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />

          <div className="flex items-center gap-2 flex-wrap">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.previewUrl}
                alt="Evidence photo"
                className="w-16 h-16 rounded-lg object-cover border border-[#e0e0e0]"
              />
            ))}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-[#d0d0d0] hover:border-gray-400 rounded-lg px-3 py-2 transition-colors min-h-0 min-w-0"
            >
              {uploadingPhoto ? (
                <span className="animate-pulse">Uploading...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Add photo
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showWOModal && currentAnswer && (
        <CreateWorkOrderModal
          initialTitle={`${currentAnswer.result}: ${question.text}`}
          initialPriority={currentAnswer.result === 'FAIL' ? 'HIGH' : 'MEDIUM'}
          siteId={siteId}
          assetId={assetId}
          inspectionId={inspectionId}
          inspectionAnswerId={answerId}
          onClose={() => setShowWOModal(false)}
        />
      )}
    </div>
  );
}

function CompletedView({ inspection, siteId, assetId }: { inspection: Inspection; siteId: string; assetId: string | null }) {
  const navigate = useNavigate();
  const [showWOModal, setShowWOModal] = useState(false);
  const [woCreated, setWoCreated] = useState<string | null>(null);

  return (
    <div className="px-4 py-8 text-center">
      <div className={`text-6xl mb-4 ${
        inspection.overallResult === 'PASS' ? 'text-[#297e49]' :
        inspection.overallResult === 'FAIL' ? 'text-[#dc2d2f]' :
        'text-[#f59e0b]'
      }`}>
        {inspection.overallResult === 'PASS' ? '✓' : inspection.overallResult === 'FAIL' ? '✗' : '!'}
      </div>
      <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">Inspection Complete</h2>
      <p className="text-gray-500 mb-6">Overall result: <strong>{inspection.overallResult}</strong></p>

      {inspection.workOrders.length > 0 && (
        <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-2">
            {inspection.workOrders.length} work order{inspection.workOrders.length !== 1 ? 's' : ''} created
          </p>
          {inspection.workOrders.map((wo) => (
            <p key={wo.id} className="text-xs text-amber-700 truncate">{wo.title}</p>
          ))}
        </div>
      )}

      {woCreated && (
        <div className="text-left bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-green-800">Work order created successfully</p>
        </div>
      )}

      <button
        onClick={() => setShowWOModal(true)}
        className="w-full border border-[#dc2d2f] text-[#dc2d2f] rounded-xl py-3 font-semibold mb-3 hover:bg-red-50 transition-colors"
      >
        + Raise Work Order
      </button>

      <button
        onClick={() => navigate('/')}
        className="w-full bg-[#1a1a1a] text-white rounded-xl py-4 font-semibold"
      >
        Back to Home
      </button>

      {showWOModal && (
        <CreateWorkOrderModal
          initialTitle={`Follow-up: ${inspection.template.name}`}
          initialPriority="MEDIUM"
          siteId={siteId}
          assetId={assetId}
          inspectionId={inspection.id}
          onClose={() => setShowWOModal(false)}
          onSuccess={(id) => { setWoCreated(id); }}
        />
      )}
    </div>
  );
}
