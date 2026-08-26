import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import api, { parseApiErrorMessage } from '../utils/api';
import {
  deriveAcademicYear,
  semesterLabel,
  isDuplicateArchive,
} from '../utils/academicYear';
import './SeasonResetWorkflow.css';

const STEPS = {
  CONFIRM: 1,
  TYPE: 2,
  ARCHIVE_INFO: 3,
  FINAL: 4,
  RESULT: 5,
};

const PROGRESS_STEPS = [
  { id: STEPS.CONFIRM, label: 'Confirm' },
  { id: STEPS.TYPE, label: 'Type' },
  { id: STEPS.ARCHIVE_INFO, label: 'Archive' },
  { id: STEPS.FINAL, label: 'Review' },
  { id: STEPS.RESULT, label: 'Result' },
];

export default function SeasonResetWorkflow({ open, onClose, onComplete, busy, setBusy }) {
  const [step, setStep] = useState(STEPS.CONFIRM);
  const [resetType, setResetType] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYearOptions, setAcademicYearOptions] = useState([]);
  const [existingArchives, setExistingArchives] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const resetState = useCallback(() => {
    setStep(STEPS.CONFIRM);
    setResetType(null);
    setAcademicYear('');
    setSemester('');
    setResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    resetState();
    onClose();
  }, [busy, onClose, resetState]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/seasons/admin/reset-options');
        if (cancelled) return;
        setAcademicYearOptions(data.academicYearOptions || []);
        setExistingArchives(data.existingArchives || []);
        const current = deriveAcademicYear();
        setAcademicYear(data.academicYearOptions?.includes(current) ? current : data.academicYearOptions?.[0] || current);
      } catch (e) {
        if (!cancelled) {
          setError(
            parseApiErrorMessage(e, 'Could not load reset options.')
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const duplicateSelected = useMemo(
    () => isDuplicateArchive(existingArchives, academicYear, semester),
    [existingArchives, academicYear, semester]
  );

  const canContinueArchiveInfo = Boolean(academicYear && semester && !duplicateSelected);

  const runReset = async () => {
    setBusy(true);
    setError(null);
    setStep(STEPS.RESULT);
    try {
      if (resetType === 'testing') {
        const { data } = await api.post('/seasons/reset', { mode: 'testing' });
        setResult({
          success: true,
          title: 'Live season reset',
          message: data.message || 'Live season reset without creating an archive.',
        });
      } else {
        const { data } = await api.post('/seasons/archive-and-reset', {
          academicYear,
          semester,
        });
        setResult({
          success: true,
          title: 'Season archived',
          message: data.message,
          detail: data.displayName || `${data.academicYear} · ${semesterLabel(data.semester)}`,
        });
      }
      onComplete();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Operation failed.';
      setResult({
        success: false,
        title: resetType === 'testing' ? 'Reset failed' : 'Archive failed',
        message: msg,
        code: e.response?.data?.code,
      });
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const getProgressStepClass = (stepId) => {
    if (resetType === 'testing' && stepId === STEPS.ARCHIVE_INFO && step >= STEPS.FINAL) {
      return 'skipped';
    }
    if (step === STEPS.RESULT && stepId < STEPS.RESULT) {
      if (resetType === 'testing' && stepId === STEPS.ARCHIVE_INFO) return 'skipped';
      return 'complete';
    }
    if (step > stepId) return 'complete';
    if (step === stepId) return 'active';
    return '';
  };

  const renderProgress = () => (
    <nav className="season-reset-progress" aria-label="Season reset progress">
      {PROGRESS_STEPS.map((progressStep, idx) => {
        const state = getProgressStepClass(progressStep.id);
        const isActive = state === 'active';
        const isComplete = state === 'complete';
        const isSkipped = state === 'skipped';
        return (
          <React.Fragment key={progressStep.id}>
            {idx > 0 ? (
              <span
                className={`season-reset-progress-line${isComplete || isActive ? ' active' : ''}${isSkipped ? ' skipped' : ''}`}
                aria-hidden="true"
              />
            ) : null}
            <div
              className={`season-reset-progress-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}${isSkipped ? ' skipped' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="season-reset-progress-dot" aria-hidden="true">
                {isSkipped ? '—' : isComplete ? '✓' : progressStep.id}
              </span>
              <span className="season-reset-progress-label">{progressStep.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );

  if (!open) return null;

  return (
    <div className="modal-overlay season-reset-overlay" role="presentation">
      <div className="modal season-reset-modal" role="dialog" aria-modal="true" aria-labelledby="season-reset-title">
        <h2 id="season-reset-title" className="season-reset-title">
          Reset Current Season
        </h2>

        {renderProgress()}

        {step === STEPS.CONFIRM && (
          <div className="season-reset-body">
            <div className="season-reset-warning">
              <AlertTriangle size={28} aria-hidden />
              <p>Are you sure you want to reset the current season?</p>
            </div>
            <p className="season-reset-copy">
              This workflow clears live league data: team standings, fixtures, match results, and
              competition stats for the new season.
              <strong> Teams, staff, and player rosters are kept</strong> so you can add or remove
              players in Player Management instead of repopulating every squad.
              You will choose whether to archive the completed season or perform a testing reset without archiving.
            </p>
            <div className="modal-actions season-reset-actions">
              <button type="button" className="btn btn-secondary season-reset-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger season-reset-btn-danger" onClick={() => setStep(STEPS.TYPE)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === STEPS.TYPE && (
          <div className="season-reset-body">
            <p className="season-reset-copy">Choose how you want to reset the live season:</p>
            <div className="season-reset-type-grid">
              <button
                type="button"
                className={`season-reset-type-card ${resetType === 'archive' ? 'selected' : ''}`}
                aria-pressed={resetType === 'archive'}
                onClick={() => setResetType('archive')}
              >
                <Archive size={22} aria-hidden />
                <strong>Archive Season &amp; Start New Season</strong>
                <span>Save a complete snapshot with academic year and semester, then reset live data.</span>
              </button>
              <button
                type="button"
                className={`season-reset-type-card ${resetType === 'testing' ? 'selected' : ''}`}
                aria-pressed={resetType === 'testing'}
                onClick={() => setResetType('testing')}
              >
                <RotateCcw size={22} aria-hidden />
                <strong>Reset Without Archiving — Testing</strong>
                <span>Clear live data only. No historical season record is created.</span>
              </button>
            </div>
            <div className="modal-actions season-reset-actions">
              <button type="button" className="btn btn-secondary season-reset-btn-secondary" onClick={() => setStep(STEPS.CONFIRM)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary season-reset-btn-primary"
                disabled={!resetType}
                onClick={() => {
                  if (resetType === 'testing') setStep(STEPS.FINAL);
                  else setStep(STEPS.ARCHIVE_INFO);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === STEPS.ARCHIVE_INFO && (
          <div className="season-reset-body">
            <p className="season-reset-copy">Provide the archive identity for this completed season:</p>
            <label className="season-reset-field">
              <span>Academic Year</span>
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                <option value="">Select academic year</option>
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="season-reset-field">
              <span>Semester</span>
              <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="">Select semester</option>
                <option value="first">First Semester</option>
                <option value="second">Second Semester</option>
              </select>
            </label>
            {duplicateSelected && (
              <p className="season-reset-error" role="alert">
                An archive already exists for {academicYear} ({semesterLabel(semester)}).
              </p>
            )}
            {!academicYear && <p className="season-reset-hint">Academic year is required.</p>}
            {!semester && academicYear && <p className="season-reset-hint">Semester is required.</p>}
            <div className="modal-actions season-reset-actions">
              <button type="button" className="btn btn-secondary season-reset-btn-secondary" onClick={() => setStep(STEPS.TYPE)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary season-reset-btn-primary"
                disabled={!canContinueArchiveInfo}
                onClick={() => setStep(STEPS.FINAL)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === STEPS.FINAL && (
          <div className="season-reset-body">
            <p className="season-reset-copy">Review and confirm:</p>
            <dl className="season-reset-summary">
              {resetType === 'archive' ? (
                <>
                  <div>
                    <dt>Academic Year</dt>
                    <dd>{academicYear}</dd>
                  </div>
                  <div>
                    <dt>Semester</dt>
                    <dd>{semesterLabel(semester)}</dd>
                  </div>
                  <div>
                    <dt>Preserved</dt>
                    <dd>Teams, staff, and player rosters (Player Management)</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>Archive current season and start a new season</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Preserved</dt>
                    <dd>Teams, staff, and player rosters (Player Management)</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>Reset live season without archiving (testing)</dd>
                  </div>
                  <div>
                    <dt>Archive</dt>
                    <dd>None — no historical season will be created</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="modal-actions season-reset-actions">
              <button
                type="button"
                className="btn btn-secondary season-reset-btn-secondary"
                onClick={() => setStep(resetType === 'archive' ? STEPS.ARCHIVE_INFO : STEPS.TYPE)}
                disabled={busy}
              >
                Back
              </button>
              <button type="button" className="btn btn-danger season-reset-btn-danger" disabled={busy} onClick={runReset}>
                {busy ? 'Processing…' : 'Confirm reset'}
              </button>
            </div>
          </div>
        )}

        {step === STEPS.RESULT && (
          <div className="season-reset-body">
            {busy && <p className="season-reset-copy">Please wait…</p>}
            {!busy && result && (
              <div className={`season-reset-result ${result.success ? 'success' : 'error'}`}>
                {result.success ? <CheckCircle2 size={32} aria-hidden /> : <XCircle size={32} aria-hidden />}
                <h3>{result.title}</h3>
                <p>{result.message}</p>
                {result.detail && <p className="season-reset-detail">{result.detail}</p>}
                {result.code && <p className="season-reset-code">Code: {result.code}</p>}
              </div>
            )}
            {!busy && (
              <div className="modal-actions season-reset-actions">
                <button type="button" className="btn btn-primary season-reset-btn-primary" onClick={handleClose}>
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        {error && step !== STEPS.RESULT && (
          <p className="season-reset-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
