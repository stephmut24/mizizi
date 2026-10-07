export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
export const splitNames = (value: string) =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

export function focusFirstError(form: HTMLFormElement) {
  requestAnimationFrame(() =>
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
