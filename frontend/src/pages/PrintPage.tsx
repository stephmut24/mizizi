import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type {
  NextWalkSheet,
  PrintedBooklet,
  PrintedCard,
  PrintPlant,
} from '../api/types';
import { formatDate } from '../utils';

type Kind = 'card' | 'booklet' | 'nextwalk';
type Document =
  | { kind: 'card'; value: PrintedCard }
  | { kind: 'booklet'; value: PrintedBooklet }
  | { kind: 'nextwalk'; value: NextWalkSheet };

async function loadDocument(
  kind: Kind,
  id: number,
  signal: AbortSignal,
): Promise<Document> {
  if (kind === 'card') return { kind, value: await api.printCard(id, signal) };
  if (kind === 'booklet')
    return { kind, value: await api.printBooklet(id, signal) };
  return { kind, value: await api.printNextWalk(id, signal) };
}

function Notice({ name }: { name: string }) {
  return (
    <p className="paper-notice">
      Traditional knowledge shared by {name}. Not medical advice.
    </p>
  );
}

function Card({ plant, name }: { plant: PrintPlant; name: string }) {
  const sections: [string, string[]][] = [
    ['Appearance', plant.appearance],
    ['Habitat', plant.habitat],
    [`Uses, as told by ${name}`, plant.uses],
    ['Preparation, as told', plant.preparation],
    ['Warnings, as told', plant.warnings],
  ];
  return (
    <article
      className="paper-page plant-print"
      aria-label={`Plant card: ${plant.local_name}`}
    >
      <header className="paper-heading">
        <p className="paper-kicker">
          Mizizi · Family herbarium · Folio #{plant.id}
        </p>
        <h1>{plant.local_name}</h1>
        <p>{plant.other_names.join(' · ') || 'No other names recorded'}</p>
        <p className="paper-label">
          Shared by {name} ·{' '}
          {plant.walk_date
            ? formatDate(plant.walk_date)
            : 'No walk date recorded'}
        </p>
      </header>
      {sections.map(([label, values]) => (
        <section className="paper-section" key={label}>
          <h2>{label}</h2>
          {values.length ? (
            <ul>
              {values.map((value, index) => (
                <li key={index}>{value}</li>
              ))}
            </ul>
          ) : (
            <p className="paper-empty">Nothing recorded yet.</p>
          )}
        </section>
      ))}
      <section className="paper-section">
        <h2>Story or proverb</h2>
        <p className="paper-story">{plant.story || 'Nothing recorded yet.'}</p>
      </section>
      <Notice name={name} />
    </article>
  );
}

function PaperDocument({ document }: { document: Document }) {
  const name = document.value.elder.display_name;
  if (document.kind === 'card')
    return <Card plant={document.value.plant} name={name} />;
  if (document.kind === 'booklet')
    return (
      <>
        <section className="paper-page booklet-cover">
          <p className="paper-kicker">Mizizi · A family herbarium</p>
          <h1>The Plants {name} Taught Me</h1>
          <p>
            A little collection of what we remembered, written down after our
            walks.
          </p>
          <p>
            {document.value.skippedPrivateCount} private{' '}
            {document.value.skippedPrivateCount === 1
              ? 'plant was'
              : 'plants were'}{' '}
            left out.
          </p>
          <h2>Contents</h2>
          {document.value.plants.length ? (
            <ol className="paper-contents">
              {document.value.plants.map((plant) => (
                <li key={plant.id}>
                  <span>{plant.local_name}</span> <span>Folio #{plant.id}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              No shareable plants yet. Return to the notebook and choose what
              you have permission to share.
            </p>
          )}
          <Notice name={name} />
        </section>
        {document.value.plants.map((plant) => (
          <Card key={plant.id} plant={plant} name={name} />
        ))}
      </>
    );
  return (
    <section className="paper-page nextwalk-print">
      <header className="paper-heading">
        <p className="paper-kicker">Mizizi · Before the next walk</p>
        <h1>A walk with {name}</h1>
        <p>Bring this, leave the phone in your pocket.</p>
        <p>Date: ____________________</p>
      </header>
      {document.value.groups.length ? (
        document.value.groups.map((group) => (
          <section className="paper-questions" key={group.plant_id}>
            <h2>{group.label}</h2>
            {group.questions.map((item) => (
              <div className="paper-question" key={item.id}>
                <h3>{item.question}</h3>
                <div
                  className="answer-lines"
                  aria-label="Space to write an answer"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </section>
        ))
      ) : (
        <p>
          No unanswered questions yet. Save a few questions in a plant’s detail
          page, then bring them on your next walk.
        </p>
      )}
      <Notice name={name} />
    </section>
  );
}

export function PrintPage({ kind }: { kind: Kind }) {
  const { id } = useParams();
  return <PrintView key={`${kind}-${id}`} kind={kind} id={Number(id)} />;
}

function PrintView({ kind, id }: { kind: Kind; id: number }) {
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const printing = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDocument(null);
    setError('');
    loadDocument(kind, id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDocument(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'This print view could not be opened.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      printing.current?.abort();
    };
  }, [kind, id, retry]);

  async function print() {
    if (printing.current) return;
    const controller = new AbortController();
    printing.current = controller;
    setLoading(true);
    setDocument(null);
    setError('');
    try {
      // Recheck visibility and consent immediately before offering the print dialog.
      const fresh = await loadDocument(kind, id, controller.signal);
      if (controller.signal.aborted) return;
      flushSync(() => {
        setDocument(fresh);
        setLoading(false);
      });
      window.print();
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : 'This print view could not be refreshed.',
        );
    } finally {
      if (!controller.signal.aborted) {
        printing.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <main className="print-view">
      <div className="print-controls stack">
        <Link
          className="text-link"
          to={kind === 'card' ? `/herbarium/${id}` : '/herbarium'}
        >
          Back to the notebook
        </Link>
        <div className="action-row">
          <h1>
            {kind === 'card'
              ? 'Print a plant card'
              : kind === 'booklet'
                ? 'Print the herbarium booklet'
                : 'Print the next-walk sheet'}
          </h1>
          <button
            className="button"
            disabled={!document || loading}
            onClick={() => void print()}
          >
            Print / Save as PDF
          </button>
        </div>
        <p>
          A5 paper · Choose “Save as PDF” in the print dialog. Turn off browser
          headers and footers. Long cards continue onto another page so no words
          are lost.
        </p>
        {kind === 'nextwalk' && (
          <p>
            This sheet is personal. Private plants appear as folio numbers, with
            questions only. Keep it within your family.
          </p>
        )}
        {loading && <p role="status">Preparing the paper notebook…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              className="button button-secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}
      </div>
      {document ? (
        <div className="print-document">
          <PaperDocument document={document} />
        </div>
      ) : (
        <p className="print-unavailable">
          There is no approved print document to display.
        </p>
      )}
    </main>
  );
}
