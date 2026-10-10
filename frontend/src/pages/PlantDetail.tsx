import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useNotebook } from '../api/notebook';
import { Icon } from '../components/Icon';
import {
  EmptyState,
  SafetyNotice,
  SpecimenPlaceholder,
  VisibilityBadge,
} from '../components/NotebookUi';
import { DeletePlantDialog } from '../components/DeletePlantDialog';
import { FollowupQuestions } from '../components/FollowupQuestions';
import { formatDate } from '../utils';

export function PlantDetail() {
  const { id } = useParams();
  const { plants, elders, walks } = useNotebook();
  const [deleting, setDeleting] = useState(false);
  const plant = plants.find((item) => String(item.id) === id);
  if (!plant)
    return (
      <EmptyState
        title="This page is no longer here"
        to="/herbarium"
        action="Back to Herbarium"
      >
        The plant may have been removed. Your other records are still in the
        herbarium.
      </EmptyState>
    );
  const elder = elders.find((item) => item.id === plant.elder_id);
  const walk = walks.find((item) => item.id === plant.walk_id);
  const name = elder?.display_name ?? 'the elder';
  const sections: [string, string[]][] = [
    ['How to recognize it', plant.appearance],
    ['Where it grows', plant.habitat],
    [`What ${name} told me about its uses`, plant.uses],
    ['Preparation, as told', plant.preparation],
    ['Warnings, as told', plant.warnings],
  ];
  return (
    <>
      <Link className="back-link text-link" to="/herbarium">
        <Icon name="arrow" />
        Back to Herbarium
      </Link>
      <div className="detail-layout">
        <article className="panel stack">
          <header className="sheet-header">
            <div>
              <p className="eyebrow">
                Folio {String(plant.id).padStart(2, '0')} · Specimen sheet
              </p>
              <h1>{plant.local_name}</h1>
              <p className="other-names">
                {plant.other_names.join(' · ') || 'No other names recorded'}
              </p>
            </div>
            <div className="action-row">
              <Link
                className="button button-secondary"
                to={`/herbarium/${plant.id}/edit`}
              >
                <Icon name="edit" />
                Edit
              </Link>
              <button
                className="button button-outline"
                onClick={() => setDeleting(true)}
              >
                <Icon name="trash" />
                Delete
              </button>
            </div>
          </header>
          <VisibilityBadge visibility={plant.visibility} />
          <SpecimenPlaceholder large folio={plant.id} />
          <div>
            {sections.map(([title, values]) => (
              <section className="observation" key={title}>
                <h2>{title}</h2>
                {values.length ? (
                  <ul>
                    {values.map((value, index) => (
                      <li key={index}>{value}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="nothing-recorded">Nothing recorded yet.</p>
                )}
              </section>
            ))}
            <section className="observation">
              <h2>A story or proverb</h2>
              <p className={plant.story ? '' : 'nothing-recorded'}>
                {plant.story || 'Nothing recorded yet.'}
              </p>
            </section>
            <section className="observation">
              <h2>Your original notes</h2>
              {plant.raw_notes ? (
                <blockquote className="source-notes">
                  {plant.raw_notes}
                </blockquote>
              ) : (
                <p className="nothing-recorded">Nothing recorded yet.</p>
              )}
            </section>
          </div>
          <p className="other-names">
            Told by {name}
            {walk
              ? ` · ${formatDate(walk.walk_date)} · ${walk.place_label}`
              : ' · No walk linked'}
          </p>
          <SafetyNotice name={name} />
        </article>
        <aside className="stack sticky-panel">
          <section className="panel stack">
            <h2>In this notebook</h2>
            <dl className="record-meta">
              <div>
                <dt>Shared by</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Walk</dt>
                <dd>
                  {walk
                    ? `${formatDate(walk.walk_date)} · ${walk.place_label}`
                    : 'No walk linked'}
                </dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>
                  {plant.visibility === 'private'
                    ? 'Private — kept in this notebook'
                    : 'Shareable — permission to share this plant'}
                </dd>
              </div>
              <div>
                <dt>Recorded</dt>
                <dd>{formatDate(plant.created_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(plant.updated_at)}</dd>
              </div>
            </dl>
          </section>
          <div className="reminder">
            <SafetyNotice name={name} />
          </div>
          <section className="panel stack">
            <h2>Take the notebook outside</h2>
            {elder?.consent_given ? (
              <>
                {plant.visibility === 'shareable' ? (
                  <Link
                    className="button button-secondary"
                    to={`/print/card/${plant.id}`}
                  >
                    Print card
                  </Link>
                ) : (
                  <p>
                    This card is private and cannot be printed. Only its saved
                    questions can appear on your personal next-walk sheet.
                  </p>
                )}
                <Link
                  className="button button-secondary"
                  to={`/print/booklet/${plant.elder_id}`}
                >
                  Print booklet
                </Link>
                <Link
                  className="button button-secondary"
                  to={`/print/nextwalk/${plant.elder_id}`}
                >
                  Print next-walk sheet
                </Link>
              </>
            ) : (
              <p>Consent must be recorded before printing this notebook.</p>
            )}
          </section>
          {!elder?.consent_given && (
            <p className="reminder">
              Consent is not currently recorded for this person. You can review
              or delete this plant, but changes cannot be saved until they
              agree.
            </p>
          )}
        </aside>
      </div>
      <FollowupQuestions
        key={`${plant.id}-${elder?.consent_given}`}
        plantId={plant.id}
        consent={Boolean(elder?.consent_given)}
      />
      {deleting && (
        <DeletePlantDialog plant={plant} onClose={() => setDeleting(false)} />
      )}
    </>
  );
}
