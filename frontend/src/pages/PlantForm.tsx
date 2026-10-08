import { useRef, useState, type FormEvent } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api } from '../api/client';
import { useNotebook } from '../api/notebook';
import type { Plant, PlantInput } from '../api/types';
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
import { focusFirstError, formatDate, splitLines } from '../utils';
import { NotesOrganizer } from '../components/NotesOrganizer';
import { quoteRange } from '../components/review';

const observations = [
  ['appearance', 'How to recognize it'],
  ['habitat', 'Where it grows'],
  ['uses', 'What they told me about its uses'],
  ['preparation', 'Preparation, as told'],
  ['warnings', 'Warnings, as told'],
] as const;

export function PlantForm() {
  const { id } = useParams();
  const { plants } = useNotebook();
  const plant = id ? plants.find((item) => String(item.id) === id) : undefined;
  if (id && !plant)
    return (
      <EmptyState
        title="This plant is no longer here"
        to="/herbarium"
        action="Back to Herbarium"
      >
        It may have been removed from the notebook.
      </EmptyState>
    );
  return <PlantEditor key={plant?.id ?? 'new'} plant={plant} />;
}

function PlantEditor({ plant }: { plant?: Plant }) {
  const { elders, walks, keepPlant, announce } = useNotebook();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { busy, error, submit } = useSubmission();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const notesElement = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState(() => ({
    elder_id: String(plant?.elder_id ?? params.get('elderId') ?? ''),
    walk_id: String(plant?.walk_id ?? params.get('walkId') ?? ''),
    local_name: plant?.local_name ?? '',
    other_names: plant?.other_names.join('\n') ?? '',
    appearance: plant?.appearance.join('\n') ?? '',
    habitat: plant?.habitat.join('\n') ?? '',
    uses: plant?.uses.join('\n') ?? '',
    preparation: plant?.preparation.join('\n') ?? '',
    warnings: plant?.warnings.join('\n') ?? '',
    story: plant?.story ?? '',
    raw_notes: plant?.raw_notes ?? '',
    visibility: plant?.visibility ?? ('private' as Plant['visibility']),
  }));
  const person = elders.find((elder) => String(elder.id) === form.elder_id);
  const consenting = elders.filter((elder) => elder.consent_given);
  const matchingWalks = walks.filter(
    (walk) => String(walk.elder_id) === form.elder_id,
  );
  const originalConsent =
    !plant ||
    elders.find((elder) => elder.id === plant.elder_id)?.consent_given;
  const back = plant ? `/herbarium/${plant.id}` : '/herbarium';

  function change(key: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'elder_id' ? { walk_id: '' } : {}),
    }));
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
    const nextErrors: Record<string, string> = {};
    if (!person?.consent_given)
      nextErrors.elder_id = 'Choose a person whose consent is recorded.';
    if (!form.local_name.trim())
      nextErrors.local_name = 'Please give this plant its local name.';
    if (
      form.walk_id &&
      !matchingWalks.some((walk) => String(walk.id) === form.walk_id)
    )
      nextErrors.walk_id = 'Choose a walk with this person, or leave it blank.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstError(event.currentTarget);
      return;
    }
    const body: PlantInput = {
      elder_id: Number(form.elder_id),
      walk_id: form.walk_id ? Number(form.walk_id) : null,
      local_name: form.local_name.trim(),
      other_names: splitLines(form.other_names),
      appearance: splitLines(form.appearance),
      habitat: splitLines(form.habitat),
      uses: splitLines(form.uses),
      preparation: splitLines(form.preparation),
      warnings: splitLines(form.warnings),
      story: form.story,
      raw_notes: form.raw_notes,
      visibility: form.visibility,
    };
    void submit(async () => {
      const saved = plant
        ? await api.updatePlant(plant.id, body)
        : await api.createPlant(body);
      keepPlant(saved);
      announce(
        plant
          ? 'Your changes were saved.'
          : 'Your plant was added to the herbarium.',
      );
      navigate(`/herbarium/${saved.id}`);
    });
  }

  if (!consenting.length || !originalConsent)
    return (
      <>
        <PageHeading
          eyebrow="Your notebook"
          title={plant ? 'Edit plant' : 'New plant'}
        >
          Every record begins with their agreement.
        </PageHeading>
        <EmptyState
          title="Record their consent first"
          to="/people"
          action="Go to People"
          icon="people"
        >
          You can only save plants for a person who agreed to share what they
          teach you. Add a person or update their consent in People.
        </EmptyState>
        <Link className="text-link" to={back}>
          Back to {plant ? 'plant' : 'Herbarium'}
        </Link>
      </>
    );

  return (
    <>
      <Link className="back-link text-link" to={back}>
        <Icon name="arrow" />
        Back to {plant ? 'plant' : 'Herbarium'}
      </Link>
      <PageHeading
        eyebrow={
          plant
            ? `Folio ${plant.id} · Your record`
            : 'A new page in your notebook'
        }
        title={plant ? 'Edit plant' : 'New plant'}
      >
        Write what they told you. Keep their words.
      </PageHeading>
      <div className="entry-layout">
        <div className="stack">
          <form
            onSubmit={save}
            noValidate
            className="form-stack"
            aria-label={plant ? 'Edit plant' : 'New plant'}
          >
            <fieldset disabled={busy} className="form-stack">
              <section className="panel">
                <div className="form-section-heading">
                  <p className="eyebrow">Ledger attributes</p>
                  <h2>Plant details</h2>
                </div>
                <div className="form-grid">
                  <Field id="elder_id" label="Person" error={errors.elder_id}>
                    <select
                      id="elder_id"
                      value={form.elder_id}
                      onChange={(event) =>
                        change('elder_id', event.target.value)
                      }
                      required
                      {...attributes('elder_id')}
                    >
                      <option value="">Choose a person</option>
                      {elders.map((elder) => (
                        <option
                          key={elder.id}
                          value={elder.id}
                          disabled={!elder.consent_given}
                        >
                          {elder.display_name}
                          {!elder.consent_given
                            ? ' — consent not recorded'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id="local_name"
                    label="Local name"
                    error={errors.local_name}
                  >
                    <input
                      id="local_name"
                      value={form.local_name}
                      onChange={(event) =>
                        change('local_name', event.target.value)
                      }
                      required
                      {...attributes('local_name')}
                    />
                  </Field>
                  <Field
                    id="walk_id"
                    label="Walk (optional)"
                    error={errors.walk_id}
                  >
                    <select
                      id="walk_id"
                      value={form.walk_id}
                      onChange={(event) =>
                        change('walk_id', event.target.value)
                      }
                      disabled={!person}
                      {...attributes('walk_id')}
                    >
                      <option value="">No walk linked</option>
                      {matchingWalks.map((walk) => (
                        <option key={walk.id} value={walk.id}>
                          {formatDate(walk.walk_date)} · {walk.place_label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id="other_names"
                    label="Other names"
                    hint="One name per line."
                  >
                    <textarea
                      id="other_names"
                      rows={2}
                      value={form.other_names}
                      onChange={(event) =>
                        change('other_names', event.target.value)
                      }
                      aria-describedby="other_names-hint"
                    />
                  </Field>
                </div>
              </section>
              <div className="mobile-specimen">
                <PlantSpecimen />
              </div>
              <section className="panel">
                <div className="form-section-heading">
                  <p className="eyebrow">Verbatim recollection</p>
                  <h2>Your notes, in your own words</h2>
                </div>
                <Field
                  id="raw_notes"
                  label="Raw notes"
                  hint="Write or use your phone keyboard’s dictation. Keep their original words."
                >
                  <textarea
                    id="raw_notes"
                    ref={notesElement}
                    rows={7}
                    value={form.raw_notes}
                    onChange={(event) =>
                      change('raw_notes', event.target.value)
                    }
                    aria-describedby="raw_notes-hint"
                  />
                </Field>
              </section>
              <NotesOrganizer
                key={JSON.stringify([form.raw_notes, form.elder_id])}
                notes={form.raw_notes}
                disabled={busy || !person?.consent_given}
                onApply={(fields) => {
                  setForm((current) => ({ ...current, ...fields }));
                  setErrors((current) => ({
                    ...current,
                    ...(fields.local_name ? { local_name: '' } : {}),
                  }));
                }}
                onQuote={(quote) => {
                  const range = quoteRange(quote, form.raw_notes);
                  if (range && notesElement.current) {
                    notesElement.current.focus();
                    notesElement.current.setSelectionRange(...range);
                    notesElement.current.scrollIntoView({
                      block: 'center',
                      behavior: 'smooth',
                    });
                  }
                }}
              />
              <section className="panel form-stack">
                <div>
                  <h2>Write the card by hand</h2>
                  <p className="field-hint">
                    Leave anything you did not discuss blank.
                  </p>
                </div>
                <p className="reminder">
                  <Icon name="info" />
                  Write only what they told you.
                </p>
                {observations.map(([key, label]) => (
                  <Field
                    key={key}
                    id={key}
                    label={label}
                    hint="One observation per line."
                  >
                    <textarea
                      id={key}
                      rows={3}
                      value={form[key]}
                      onChange={(event) => change(key, event.target.value)}
                      aria-describedby={`${key}-hint`}
                    />
                  </Field>
                ))}
                <Field id="story" label="A story or proverb">
                  <textarea
                    id="story"
                    rows={4}
                    value={form.story}
                    onChange={(event) => change('story', event.target.value)}
                  />
                </Field>
              </section>
              <section className="panel form-stack">
                <Field
                  id="visibility"
                  label="Who may this plant be shared with?"
                  hint="Private plants stay in this notebook. Choose Shareable only with their permission."
                >
                  <select
                    id="visibility"
                    value={form.visibility}
                    onChange={(event) =>
                      change('visibility', event.target.value)
                    }
                    aria-describedby="visibility-hint"
                  >
                    <option value="private">Private</option>
                    <option value="shareable">Shareable</option>
                  </select>
                </Field>
                <SafetyNotice name={person?.display_name ?? 'the elder'} />
              </section>
            </fieldset>
            <FormError message={error} />
            <div className="form-actions">
              <button
                type="button"
                disabled={busy}
                className="button button-secondary"
                onClick={() => navigate(back)}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={busy || !person?.consent_given}
                type="submit"
              >
                <Icon name="check" />
                {busy ? 'Saving…' : plant ? 'Save changes' : 'Save plant'}
              </button>
            </div>
          </form>
        </div>
        <aside className="stack sticky-panel desktop-specimen">
          <PlantSpecimen />
          <p className="reminder">
            <Icon name="lock" />
            <span>
              Your notes stay on this computer. Nothing is saved until you
              choose Save.
            </span>
          </p>
        </aside>
      </div>
    </>
  );
}

function PlantSpecimen() {
  return (
    <div className="panel stack">
      <p className="eyebrow">Field specimen</p>
      <SpecimenPlaceholder large />
      <p className="field-hint">
        A photo can be added in a later version. Your words are enough to start.
      </p>
    </div>
  );
}
