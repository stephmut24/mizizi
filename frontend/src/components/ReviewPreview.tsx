import { useState } from 'react';
import { Icon } from './Icon';

// TODO connect in prompt 04. Development-only fixture; never sent to the API.
const examples = [
  { group: 'Names', value: 'Garden leaf', quote: 'We call it garden leaf.' },
  {
    group: 'Appearance',
    value: 'Soft green leaves',
    quote: 'Its leaves are soft and green.',
  },
  {
    group: 'Habitat',
    value: 'Beside the kitchen wall',
    quote: 'It grows beside the kitchen wall.',
  },
  {
    group: 'Story',
    value: 'Planted with a grandmother',
    quote: 'I planted it with my grandmother.',
  },
];

export default function ReviewPreview() {
  const [items, setItems] = useState(
    examples.map((item) => ({ ...item, selected: true })),
  );
  const [message, setMessage] = useState('');
  return (
    <section className="panel stack" aria-labelledby="review-heading">
      <p className="preview-label">
        Development preview · fictional sample · no AI is running
      </p>
      <div>
        <p className="eyebrow">Review layout</p>
        <h2 id="review-heading">Here is what I found in your notes</h2>
        <p className="field-hint">
          These sample items are separate from your plant. They cannot be saved
          to it.
        </p>
      </div>
      <details>
        <summary className="text-link">Read the fictional sample notes</summary>
        <blockquote className="source-notes">
          {examples.map((item) => item.quote).join(' ')}
        </blockquote>
      </details>
      <p className="review-summary">
        4 items kept · 1 removed because it was not found in the sample notes ·{' '}
        {items.filter((item) => item.selected).length} selected
      </p>
      <div>
        {items.map((item, index) => (
          <div className="review-group" key={item.group}>
            <p className="section-label">{item.group}</p>
            <div className="review-line">
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
                  Keep sample {item.group.toLowerCase()}
                </span>
              </label>
              <div>
                <label className="sr-only" htmlFor={`sample-${index}`}>
                  Sample {item.group.toLowerCase()}
                </label>
                <input
                  id={`sample-${index}`}
                  value={item.value}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry, i) =>
                        i === index
                          ? { ...entry, value: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <p className="review-quote">From your notes: “{item.quote}”</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="review-missing">
        <strong>Still missing:</strong>
        <ul>
          <li>Nothing about its uses.</li>
          <li>Nothing about preparation or warnings.</li>
        </ul>
      </div>
      <div className="action-row">
        <button
          type="button"
          className="button"
          onClick={() =>
            setMessage('Preview only. No sample content was copied or saved.')
          }
        >
          Use these in my card — preview
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setItems(examples.map((item) => ({ ...item, selected: true })));
            setMessage('The sample review was reset. Your plant is unchanged.');
          }}
        >
          Reset preview
        </button>
      </div>
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
      <p className="reminder">
        <Icon name="info" />
        The AI only rewrites what you wrote. Check every line against what you
        remember. This is not medical advice.
      </p>
    </section>
  );
}
