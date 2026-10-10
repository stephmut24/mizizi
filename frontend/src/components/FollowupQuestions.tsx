import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Followup, QuestionProposal } from '../api/types';

export function FollowupQuestions({
  plantId,
  consent,
}: {
  plantId: number;
  consent: boolean;
}) {
  const [questions, setQuestions] = useState<Followup[]>([]);
  const [proposal, setProposal] = useState<QuestionProposal | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const writing = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .followups(plantId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setQuestions(items);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Questions could not be loaded.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      controller.abort();
      pending.current?.abort();
      pending.current = null;
    };
  }, [plantId, retry]);

  function cancel() {
    pending.current?.abort();
    pending.current = null;
    setSuggesting(false);
    setProposal(null);
    setChosen([]);
  }

  async function suggest() {
    if (pending.current || writing.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSuggesting(true);
    setProposal(null);
    setNotice('');
    setError('');
    try {
      const result = await api.suggestQuestions(plantId, controller.signal);
      if (controller.signal.aborted) return;
      setProposal(result);
      setChosen(
        result.questions.filter(
          (question) => !questions.some((saved) => saved.question === question),
        ),
      );
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Please try suggesting questions again.',
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSuggesting(false);
      }
    }
  }

  async function save(operation: () => Promise<Followup[]>, message: string) {
    if (writing.current) return;
    writing.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await operation();
      if (!mounted.current) return;
      setQuestions((items) =>
        [
          ...items.filter(
            (item) => !saved.some((record) => record.id === item.id),
          ),
          ...saved,
        ].sort((a, b) => a.id - b.id),
      );
      setNotice(message);
      setProposal(null);
      setChosen([]);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'The questions could not be saved.',
        );
    } finally {
      writing.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section
      className="panel stack followup-section"
      aria-labelledby="followup-heading"
    >
      <div>
        <p className="eyebrow">Bring your curiosity</p>
        <h2 id="followup-heading">Questions for next time</h2>
      </div>
      <p>
        Choose what you want to ask. Nothing is saved until you select “Save
        selected questions”.
      </p>
      {loading ? (
        <p role="status">Opening your questions…</p>
      ) : questions.length ? (
        <ul className="question-list">
          {questions.map((item) => (
            <li key={item.id}>
              <span>
                {item.question}
                {item.answered && (
                  <small className="answered-label">Answered</small>
                )}
              </span>
              <button
                className="button button-secondary"
                disabled={!consent || saving || suggesting}
                onClick={() =>
                  void save(
                    async () => [
                      await api.answerQuestion(item.id, !item.answered),
                    ],
                    item.answered
                      ? 'Question reopened for your next walk.'
                      : 'Question marked as answered.',
                  )
                }
              >
                {item.answered ? 'Ask again' : 'Mark answered'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No questions saved yet. Make a little room for the next conversation.
        </p>
      )}
      {error && (
        <div role="alert" className="reminder">
          <p>{error}</p>
          <button
            className="button button-secondary"
            disabled={saving || suggesting}
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload questions
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {suggesting ? (
        <div className="reminder">
          <p role="status">
            The model runs on this computer and may take a minute. If it is
            unavailable, notebook questions will be offered instead.
          </p>
          <button className="button button-secondary" onClick={cancel}>
            Cancel suggestions
          </button>
        </div>
      ) : (
        <button
          className="button button-secondary"
          disabled={!consent || loading || saving}
          onClick={() => void suggest()}
        >
          Suggest questions for next time
        </button>
      )}
      {proposal && (
        <div className="stack question-proposals">
          <h3>Choose your questions</h3>
          <p>
            {proposal.source === 'templates'
              ? 'The local model could not offer usable questions. These notebook questions are based on gaps in your card.'
              : 'Suggested by your local model. Check that each question fits what you remember.'}
          </p>
          {proposal.questions.map((question) => {
            const exists = questions.some((item) => item.question === question);
            return (
              <label className="check-row" key={question}>
                <input
                  type="checkbox"
                  disabled={exists || saving}
                  checked={chosen.includes(question)}
                  onChange={(event) =>
                    setChosen((items) =>
                      event.target.checked
                        ? [...items, question]
                        : items.filter((item) => item !== question),
                    )
                  }
                />
                <span>
                  {question}
                  {exists && (
                    <small className="answered-label">
                      Already in your notebook
                    </small>
                  )}
                </span>
              </label>
            );
          })}
          <div className="action-row">
            <button
              className="button"
              disabled={!consent || !chosen.length || saving}
              onClick={() =>
                void save(
                  () => api.saveQuestions(plantId, chosen),
                  'Your chosen questions are saved for the next walk.',
                )
              }
            >
              {saving ? 'Saving questions…' : 'Save selected questions'}
            </button>
            <button
              className="button button-secondary"
              disabled={saving}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!consent && (
        <p className="reminder">
          Record this person’s consent before suggesting or saving questions.
        </p>
      )}
      <p className="form-hint">
        Questions are invitations to ask, not facts or medical advice.
      </p>
    </section>
  );
}
