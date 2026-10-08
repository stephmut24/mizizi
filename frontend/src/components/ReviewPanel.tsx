import { useState } from 'react';
import type { OrganizedTopic, OrganizerProposal } from '../api/types';
import {
  reviewFields,
  reviewItems,
  reviewedFields,
  type ReviewedFields,
} from './review';

export function ReviewPanel({
  proposal,
  onApply,
  onCancel,
  onQuote,
}: {
  proposal: OrganizerProposal;
  onApply: (fields: ReviewedFields) => void;
  onCancel: () => void;
  onQuote: (quote: string) => void;
}) {
  const [items, setItems] = useState(() => reviewItems(proposal));
  const selected = items.filter(
    (item) => item.selected && item.text.trim(),
  ).length;
  const quotesOnly = proposal.rejected.every(
    (item) => item.reason === 'quote_not_found',
  );
  return (
    <section className="stack" aria-labelledby="review-heading">
      <h2 id="review-heading">Here is what I found in your notes</h2>
      <p className="review-summary" role="status">
        {proposal.kept} items kept, {proposal.removed} removed
        {proposal.removed > 0
          ? quotesOnly
            ? ' because they were not found in your notes.'
            : ' because they did not pass the evidence checks.'
          : '.'}{' '}
        {selected} selected.
      </p>
      <p className="field-hint">
        Review every line. Tap a quote to find it in your original notes. Your
        edits are your own words; check that they still match the quote.
      </p>
      {(Object.keys(reviewFields) as OrganizedTopic[]).map((field) => (
        <div className="review-group" key={field}>
          <h3 className="section-label">{reviewFields[field][1]}</h3>
          {!items.some((item) => item.field === field) && (
            <p className="field-hint">No proposal for this field.</p>
          )}
          {items.map(
            (item, index) =>
              item.field === field && (
                <div className="review-line" key={index}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, selected: event.target.checked }
                              : entry,
                          ),
                        )
                      }
                    />
                    <span className="sr-only">
                      Include {reviewFields[field][1]} {index + 1}
                    </span>
                  </label>
                  <div>
                    <label className="sr-only" htmlFor={`review-${index}`}>
                      {reviewFields[field][1]} proposal {index + 1}
                    </label>
                    <input
                      id={`review-${index}`}
                      value={item.text}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, text: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.preventDefault();
                      }}
                    />
                    <button
                      type="button"
                      className="review-quote quote-link"
                      onClick={() => onQuote(item.quote)}
                    >
                      From your notes: “{item.quote}”
                    </button>
                  </div>
                </div>
              ),
          )}
        </div>
      ))}
      {proposal.missing.length > 0 && (
        <div className="review-missing">
          <strong>Still missing</strong>
          <p className="field-hint">
            No verified proposal for these topics. Check your notes or ask on
            your next walk.
          </p>
          <ul>
            {proposal.missing.map((field) => (
              <li key={field}>{reviewFields[field][2]}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="field-hint">
        Selected lines replace the matching form fields. Fields with no selected
        lines stay unchanged. Nothing is saved until you press Save.
      </p>
      <div className="action-row">
        <button
          type="button"
          className="button"
          disabled={!selected}
          onClick={() => onApply(reviewedFields(items))}
        >
          Use these in my card
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
