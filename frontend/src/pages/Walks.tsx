import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useNotebook } from '../api/notebook';
import { Icon } from '../components/Icon';
import {
  EmptyState,
  Field,
  FormError,
  PageHeading,
  SafetyNotice,
  SpecimenPlaceholder,
} from '../components/NotebookUi';
import { useSubmission } from '../components/useSubmission';
import { focusFirstError, formatDate, today } from '../utils';

export function Walks() {
  const { elders, walks, plants, keepWalk, announce } = useNotebook();
  const [form, setForm] = useState({
    elder_id: '',
    walk_date: today(),
    place_label: '',
    duration_minutes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, submit } = useSubmission();
  const sorted = [...walks].sort(
    (a, b) => b.walk_date.localeCompare(a.walk_date) || b.id - a.id,
  );
  const walkedPlants = plants.filter((plant) => plant.walk_id !== null);
  function change(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }
  function attributes(key: string) {
    return {
      'aria-invalid': Boolean(errors[key]),
      'aria-describedby': errors[key] ? `${key}-error` : undefined,
    };
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!elders.some((elder) => String(elder.id) === form.elder_id))
      next.elder_id = 'Choose the person you walked with.';
    const date = new Date(`${form.walk_date}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.walk_date) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== form.walk_date
    )
      next.walk_date = 'Choose a valid date for this walk.';
    if (!form.place_label.trim())
      next.place_label = 'Give the place a short label.';
    if (form.place_label.trim().length > 200)
      next.place_label = 'Keep the place label within 200 characters.';
    const duration =
      form.duration_minutes.trim() === ''
        ? null
        : Number(form.duration_minutes);
    if (duration !== null && (!Number.isSafeInteger(duration) || duration < 0))
      next.duration_minutes = 'Use a whole number of minutes, zero or more.';
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget);
      return;
    }
    void submit(async () => {
      const walk = await api.createWalk({
        elder_id: Number(form.elder_id),
        walk_date: form.walk_date,
        place_label: form.place_label.trim(),
        duration_minutes: duration,
      });
      keepWalk(walk);
      announce(
        'Your walk was recorded. You can add its plants whenever you are ready.',
      );
      setForm((current) => ({
        ...current,
        place_label: '',
        duration_minutes: '',
      }));
    });
  }

  return (
    <>
      <PageHeading
        eyebrow="Field journal ledger"
        title="Walks"
        aside={
          <span className="quiet-label">
            {walks.length} recorded {walks.length === 1 ? 'walk' : 'walks'}
          </span>
        }
      >
        Each walk, who you walked with and what you learned.
      </PageHeading>
      {elders.length === 0 ? (
        <EmptyState
          title="Who will you walk with?"
          to="/people"
          action="Add a person"
          icon="people"
        >
          Add someone to your notebook, then come back to record your walk.
        </EmptyState>
      ) : (
        <div className="walks-layout">
          <section className="panel sticky-panel">
            <div className="form-section-heading">
              <p className="eyebrow">A shared moment outside</p>
              <h2>Start a walk</h2>
            </div>
            <form
              onSubmit={save}
              noValidate
              className="form-stack"
              aria-label="Start a walk"
            >
              <fieldset disabled={busy} className="form-stack">
                <Field id="elder_id" label="Person" error={errors.elder_id}>
                  <select
                    id="elder_id"
                    value={form.elder_id}
                    onChange={(event) => change('elder_id', event.target.value)}
                    required
                    {...attributes('elder_id')}
                  >
                    <option value="">Choose a person</option>
                    {elders.map((elder) => (
                      <option key={elder.id} value={elder.id}>
                        {elder.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="two-fields">
                  <Field id="walk_date" label="Date" error={errors.walk_date}>
                    <input
                      id="walk_date"
                      type="date"
                      value={form.walk_date}
                      onChange={(event) =>
                        change('walk_date', event.target.value)
                      }
                      required
                      {...attributes('walk_date')}
                    />
                  </Field>
                  <Field
                    id="duration_minutes"
                    label="Minutes (optional)"
                    error={errors.duration_minutes}
                  >
                    <input
                      id="duration_minutes"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={form.duration_minutes}
                      onChange={(event) =>
                        change('duration_minutes', event.target.value)
                      }
                      {...attributes('duration_minutes')}
                    />
                  </Field>
                </div>
                <Field
                  id="place_label"
                  label="Place label"
                  error={errors.place_label}
                  hint="Just a short label. No GPS coordinates are stored."
                >
                  <input
                    id="place_label"
                    maxLength={200}
                    placeholder="e.g. garden behind the house"
                    value={form.place_label}
                    onChange={(event) =>
                      change('place_label', event.target.value)
                    }
                    required
                    {...attributes('place_label')}
                    aria-describedby={
                      errors.place_label
                        ? 'place_label-error place_label-hint'
                        : 'place_label-hint'
                    }
                  />
                </Field>
                <button type="submit" className="button">
                  <Icon name="check" />
                  {busy ? 'Saving…' : 'Save walk'}
                </button>
              </fieldset>
              <FormError message={error} />
              <p className="field-hint">
                Record the walk before or after you go. Add the plants when you
                are back.
              </p>
            </form>
          </section>
          <div className="stack">
            <section className="panel">
              <div className="ledger-heading">
                <h2>Walk records</h2>
                <span>
                  {walks.length} {walks.length === 1 ? 'walk' : 'walks'}
                </span>
              </div>
              {sorted.length ? (
                <>
                  <div>
                    {sorted.map((walk) => {
                      const elder = elders.find(
                        (item) => item.id === walk.elder_id,
                      );
                      return (
                        <article className="walk-row" key={walk.id}>
                          <div>
                            <div className="walk-row-title">
                              <Icon name="walk" size={18} />
                              <strong>{formatDate(walk.walk_date)}</strong>
                              <span>
                                · {elder?.display_name ?? 'the elder'}
                              </span>
                            </div>
                            <p>
                              {walk.place_label}
                              {walk.duration_minutes !== null
                                ? ` · ${walk.duration_minutes} min`
                                : ''}
                            </p>
                          </div>
                          <span className="badge badge-green">
                            {walk.plant_count}{' '}
                            {walk.plant_count === 1 ? 'plant' : 'plants'}
                          </span>
                          {elder?.consent_given ? (
                            <Link
                              className="text-link"
                              to={`/herbarium/new?elderId=${walk.elder_id}&walkId=${walk.id}`}
                            >
                              <Icon name="plus" size={16} />
                              Add a plant from this walk
                            </Link>
                          ) : (
                            <Link className="text-link" to="/people">
                              Record consent before adding plants
                            </Link>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <p className="ledger-summary">
                    {walkedPlants.length}{' '}
                    {walkedPlants.length === 1 ? 'plant' : 'plants'} recorded
                    across {walks.length}{' '}
                    {walks.length === 1 ? 'walk' : 'walks'}
                  </p>
                </>
              ) : (
                <div className="empty-state">
                  <span className="round-motif">
                    <Icon name="walk" size={36} />
                  </span>
                  <h3>No walks yet</h3>
                  <p>
                    Go for a walk with someone, then come back and write down
                    what you learned.
                  </p>
                  <button
                    className="button button-secondary"
                    onClick={() => document.getElementById('elder_id')?.focus()}
                  >
                    Record first walk
                  </button>
                </div>
              )}
            </section>
            {walkedPlants.length > 0 && (
              <section className="panel stack">
                <div>
                  <p className="eyebrow">Specimen registry</p>
                  <h2>Recorded during walks</h2>
                </div>
                <div className="walk-specimens">
                  {walkedPlants.slice(0, 4).map((plant) => {
                    const name =
                      elders.find((elder) => elder.id === plant.elder_id)
                        ?.display_name ?? 'the elder';
                    return (
                      <article className="mini-specimen" key={plant.id}>
                        <Link to={`/herbarium/${plant.id}`}>
                          <SpecimenPlaceholder />
                          <h3>{plant.local_name}</h3>
                        </Link>
                        <SafetyNotice name={name} />
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
