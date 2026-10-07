import { Link, useSearchParams } from 'react-router-dom';
import { useNotebook } from '../api/notebook';
import { Icon } from '../components/Icon';
import {
  EmptyState,
  PageHeading,
  SafetyNotice,
  SpecimenPlaceholder,
  VisibilityBadge,
} from '../components/NotebookUi';
import { formatDate } from '../utils';

export function Herbarium() {
  const { plants, elders, walks } = useNotebook();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const elderId = params.get('elderId') ?? '';
  const query = search.trim().toLocaleLowerCase();
  const visible = plants.filter(
    (plant) =>
      (!elderId || String(plant.elder_id) === elderId) &&
      (!query ||
        [plant.local_name, ...plant.other_names].some((name) =>
          name.toLocaleLowerCase().includes(query),
        )),
  );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeading
        eyebrow={`Field journal · ${plants.length} recorded ${plants.length === 1 ? 'plant' : 'plants'}`}
        title="Herbarium"
      >
        Everything they taught you, in one place.
      </PageHeading>
      <div className="toolbar" role="search" aria-label="Find a plant">
        <div className="search-field">
          <label className="sr-only" htmlFor="plant-search">
            Search by name
          </label>
          <Icon name="search" />
          <input
            id="plant-search"
            type="search"
            value={search}
            placeholder="Search by name…"
            onChange={(event) => filter('search', event.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="person-filter">
          Filter by person
        </label>
        <select
          id="person-filter"
          value={elderId}
          onChange={(event) => filter('elderId', event.target.value)}
        >
          <option value="">All people</option>
          {elders.map((elder) => (
            <option key={elder.id} value={elder.id}>
              {elder.display_name}
            </option>
          ))}
        </select>
        <Link className="button" to="/herbarium/new">
          <Icon name="plus" />
          New plant
        </Link>
      </div>
      {plants.length === 0 ? (
        <EmptyState
          title="Your herbarium is empty"
          to={
            elders.some((elder) => elder.consent_given)
              ? '/herbarium/new'
              : '/people'
          }
          action={
            elders.some((elder) => elder.consent_given)
              ? 'New plant'
              : 'Add a person'
          }
        >
          Walk with someone, then come back and write down what they taught you.
        </EmptyState>
      ) : visible.length === 0 ? (
        <section className="empty-state panel">
          <Icon name="search" size={36} />
          <h2>No plants match just yet</h2>
          <p>Try another name or choose a different person.</p>
          <button
            className="button button-secondary"
            onClick={() => setParams({})}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'plant' : 'plants'} in this
            view
          </p>
          <div className="herbarium-grid">
            {visible.map((plant) => {
              const elder = elders.find((item) => item.id === plant.elder_id);
              const walk = walks.find((item) => item.id === plant.walk_id);
              const name = elder?.display_name ?? 'the elder';
              const note = plant.raw_notes.trim();
              return (
                <article className="plant-card" key={plant.id}>
                  <Link
                    to={`/herbarium/${plant.id}`}
                    className="card-link"
                    aria-label={`Open ${plant.local_name}, told by ${name}`}
                  >
                    <SpecimenPlaceholder folio={plant.id} />
                    <div className="card-body">
                      <h2>{plant.local_name}</h2>
                      <p className="other-names">
                        {plant.other_names.join(' · ') ||
                          'No other names recorded'}
                      </p>
                      <p className="card-quote">
                        {note
                          ? `“${note.slice(0, 125)}${note.length > 125 ? '…' : ''}”`
                          : 'A page for what they shared with you.'}
                      </p>
                    </div>
                  </Link>
                  <div className="card-label">
                    <span className="attribution">
                      <Icon name="people" size={15} />
                      <span>
                        {name} ·{' '}
                        {walk ? formatDate(walk.walk_date) : 'No walk linked'}
                      </span>
                    </span>
                    <VisibilityBadge visibility={plant.visibility} />
                  </div>
                  <SafetyNotice name={name} />
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
