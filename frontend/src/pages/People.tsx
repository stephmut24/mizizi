import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useNotebook } from '../api/notebook';
import type { Elder } from '../api/types';
import { Icon } from '../components/Icon';
import { Field, FormError, PageHeading } from '../components/NotebookUi';
import { useSubmission } from '../components/useSubmission';
import { focusFirstError, splitNames } from '../utils';

export function People() {
  const { elders, plants, walks, keepElder, announce } = useNotebook();
  const [editing, setEditing] = useState<Elder | null>(null);
  const [form, setForm] = useState({
    display_name: '',
    languages: '',
    consent_given: false,
    consent_note: '',
  });
  const [nameError, setNameError] = useState('');
  const { busy, error, submit, setError } = useSubmission();
  function reset() {
    setEditing(null);
    setForm({
      display_name: '',
      languages: '',
      consent_given: false,
      consent_note: '',
    });
    setNameError('');
    setError('');
  }
  function edit(elder: Elder) {
    setEditing(elder);
    setForm({
      display_name: elder.display_name,
      languages: elder.languages.join(', '),
      consent_given: elder.consent_given,
      consent_note: elder.consent_note,
    });
    setNameError('');
    setError('');
    requestAnimationFrame(() => {
      document
        .getElementById('person-form')
        ?.scrollIntoView({ block: 'start' });
      document.getElementById('display_name')?.focus({ preventScroll: true });
    });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.display_name.trim()) {
      setNameError('Please enter their name.');
      focusFirstError(event.currentTarget);
      return;
    }
    setNameError('');
    void submit(async () => {
      const body = {
        ...form,
        display_name: form.display_name.trim(),
        languages: splitNames(form.languages),
      };
      const elder = editing
        ? await api.updateElder(editing.id, body)
        : await api.createElder(body);
      keepElder(elder);
      announce(
        elder.consent_given
          ? 'Person saved. Their consent is recorded in your notebook.'
          : 'Person saved without consent. Plants cannot be added for them yet.',
      );
      reset();
    });
  }
  return (
    <>
      <PageHeading eyebrow="Elders & knowledge keepers" title="People">
        Only people who agreed can have plants in this notebook.
      </PageHeading>
      <div className="people-layout">
        <section className="people-form panel sticky-panel" id="person-form">
          <div className="form-section-heading">
            <p className="eyebrow">
              {editing ? 'Update their record' : 'Begin with a conversation'}
            </p>
            <h2>{editing ? 'Edit person' : 'Add a person'}</h2>
          </div>
          <form
            onSubmit={save}
            noValidate
            className="form-stack"
            aria-label={editing ? 'Edit person' : 'Add a person'}
          >
            <fieldset disabled={busy} className="form-stack">
              <Field id="display_name" label="Name" error={nameError}>
                <input
                  id="display_name"
                  autoComplete="off"
                  placeholder="e.g. Bibi Amina"
                  value={form.display_name}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }));
                    setNameError('');
                  }}
                  required
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={
                    nameError ? 'display_name-error' : undefined
                  }
                />
              </Field>
              <Field
                id="languages"
                label="Languages"
                hint="Separate languages with commas."
              >
                <input
                  id="languages"
                  placeholder="e.g. Swahili, English"
                  value={form.languages}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      languages: event.target.value,
                    }))
                  }
                  aria-describedby="languages-hint"
                />
              </Field>
              <div className="consent-block">
                <label className="check-row">
                  <input
                    id="consent_given"
                    type="checkbox"
                    checked={form.consent_given}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        consent_given: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    They agree to share what they teach me in this notebook
                  </span>
                </label>
                <p className="field-hint">
                  Ask them first. Leave this unchecked if they have not agreed
                  yet.
                </p>
              </div>
              <Field
                id="consent_note"
                label="How did they agree?"
                hint="Record their actual agreement in your own words."
              >
                <textarea
                  id="consent_note"
                  rows={3}
                  value={form.consent_note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      consent_note: event.target.value,
                    }))
                  }
                  aria-describedby="consent_note-hint"
                />
              </Field>
              <button className="button" type="submit">
                <Icon name="people" />
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Save person'}
              </button>
              {editing && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={reset}
                >
                  Cancel editing
                </button>
              )}
            </fieldset>
            <FormError message={error} />
            <p className="field-hint">
              <Icon name="lock" size={16} /> You can only add plants for people
              who agreed.
            </p>
          </form>
        </section>
        <section
          className="people-records stack"
          aria-label="People in your notebook"
        >
          <div className="ledger-heading">
            <h2>People in your notebook</h2>
            <span>
              {elders.length} {elders.length === 1 ? 'person' : 'people'}
            </span>
          </div>
          {elders.length === 0 ? (
            <div className="panel empty-state">
              <span className="round-motif">
                <Icon name="people" size={36} />
              </span>
              <h3>A notebook starts with someone</h3>
              <p>
                Who would you like to walk with? Ask them about keeping their
                teachings, then add their name.
              </p>
              <button
                className="button button-secondary"
                onClick={() => document.getElementById('display_name')?.focus()}
              >
                Add your first person
              </button>
            </div>
          ) : (
            elders.map((elder) => (
              <article className="panel stack" key={elder.id}>
                <div className="person-header">
                  <div>
                    <h2>{elder.display_name}</h2>
                    <p className="person-languages">
                      {elder.languages.join(', ') || 'No languages recorded'}
                    </p>
                  </div>
                  <span
                    className={`badge ${elder.consent_given ? 'badge-green' : 'badge-private'}`}
                  >
                    <Icon
                      name={elder.consent_given ? 'check' : 'lock'}
                      size={15}
                    />
                    {elder.consent_given
                      ? 'Consent recorded'
                      : 'Consent not recorded'}
                  </span>
                </div>
                <p className="person-note">
                  {elder.consent_note || 'No consent note recorded.'}
                </p>
                <div className="person-stats">
                  <span>
                    <Icon name="leaf" size={18} />
                    {
                      plants.filter((plant) => plant.elder_id === elder.id)
                        .length
                    }{' '}
                    {plants.filter((plant) => plant.elder_id === elder.id)
                      .length === 1
                      ? 'plant recorded'
                      : 'plants recorded'}
                  </span>
                  <span>
                    <Icon name="walk" size={18} />
                    {
                      walks.filter((walk) => walk.elder_id === elder.id).length
                    }{' '}
                    {walks.filter((walk) => walk.elder_id === elder.id)
                      .length === 1
                      ? 'walk together'
                      : 'walks together'}
                  </span>
                </div>
                <div className="action-row">
                  <Link
                    className="button button-outline"
                    to={`/herbarium?elderId=${elder.id}`}
                  >
                    <Icon name="book" size={18} />
                    View plants
                  </Link>
                  <button
                    disabled={busy}
                    className="button button-secondary"
                    onClick={() => edit(elder)}
                  >
                    <Icon name="edit" size={18} />
                    Edit person
                  </button>
                </div>
              </article>
            ))
          )}
          <aside className="reminder">
            <Icon name="info" />
            <p>
              Consent can change. If someone withdraws their agreement, update
              their record. Existing plants stay available for review or
              deletion; further changes are blocked until they agree again.
            </p>
          </aside>
        </section>
      </div>
    </>
  );
}
