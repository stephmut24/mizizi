import { useRef, useState } from 'react';

export function useSubmission() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Something went wrong. Your entries are still here.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, submit, setError };
}
