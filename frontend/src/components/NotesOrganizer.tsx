import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { OrganizerProposal } from '../api/types';
import { ReviewPanel } from './ReviewPanel';
import { FormError } from './NotebookUi';
import type { ReviewedFields } from './review';

export function NotesOrganizer({
  notes,
  disabled,
  onApply,
  onQuote,
}: {
  notes: string;
  disabled: boolean;
  onApply: (fields: ReviewedFields) => void;
  onQuote: (quote: string) => void;
}) {
  const active = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<OrganizerProposal | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      active.current?.abort();
      active.current = null;
      setPending(false);
      setProposal(null);
    }
  }, [disabled]);

  function cancel() {
    active.current?.abort();
    active.current = null;
    setPending(false);
    setProposal(null);
    setMessage('Review cancelled. Your card fields are unchanged.');
  }
  async function organize() {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setProposal(null);
    setError('');
    setMessage('');
    try {
      const result = await api.organize(notes, controller.signal);
      if (active.current === controller && !controller.signal.aborted)
        setProposal(result);
    } catch (failure) {
      if (active.current === controller && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'The local AI could not finish. You can still write the card by hand.',
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }
  return (
    <section className="panel stack" aria-label="Local AI notes organizer">
      <div>
        <p className="eyebrow">Optional local help</p>
        <h2>Organize, then review</h2>
      </div>
      {!pending && !proposal && (
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled || !notes.trim()}
          onClick={() => void organize()}
        >
          Organize my notes with local AI
        </button>
      )}
      {disabled && (
        <p className="field-hint">
          Organizing is available when a consenting person is selected and the
          card is not being saved.
        </p>
      )}
      {pending && (
        <div className="stack">
          <p role="status">
            The model runs on this computer and may take a minute. You can keep
            writing; changing the notes cancels this request.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={cancel}
          >
            Cancel
          </button>
        </div>
      )}
      <FormError message={error} />
      {message && <p role="status">{message}</p>}
      {proposal && (
        <ReviewPanel
          proposal={proposal}
          onQuote={onQuote}
          onCancel={cancel}
          onApply={(fields) => {
            onApply(fields);
            setProposal(null);
            setMessage(
              'Selected lines copied to your card. Check the fields, then press Save when you are ready. Nothing has been saved yet.',
            );
          }}
        />
      )}
      <p className="reminder">
        The AI only rewrites what you wrote. Check every line against what you
        remember. This is not medical advice.
      </p>
    </section>
  );
}
