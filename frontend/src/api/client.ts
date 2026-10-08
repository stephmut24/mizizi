import type {
  Elder,
  ElderInput,
  Plant,
  PlantInput,
  Walk,
  WalkInput,
  OrganizerProposal,
} from './types';

export const connectionMessage =
  'The server is not reachable. Is the computer on and on the same Wi-Fi?';

async function request<T>(
  path: string,
  options: RequestInit = {},
  organizer = false,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  // The backend owns the configurable AI deadline (including its one retry).
  const timer = organizer ? undefined : window.setTimeout(cancel, 15000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: options.body
        ? { 'Content-Type': 'application/json' }
        : undefined,
    });
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      let message =
        response.status >= 500
          ? 'The notebook could not complete that request. Please try again.'
          : 'That record could not be saved. Please check the details.';
      if (
        data &&
        typeof data === 'object' &&
        'message' in data &&
        (response.status < 500 || (organizer && response.status === 503))
      ) {
        if (typeof data.message === 'string') message = data.message;
        if (Array.isArray(data.message))
          message = data.message
            .filter((item) => typeof item === 'string')
            .join(' ');
      }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (options.signal?.aborted)
      throw new DOMException('Request cancelled', 'AbortError');
    if (controller.signal.aborted) {
      throw new Error(
        'The server is taking longer than expected. If you were saving, check the notebook before trying again.',
      );
    }
    if (error instanceof TypeError) throw new Error(connectionMessage);
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const api = {
  organize: (rawNotes: string, signal: AbortSignal) =>
    request<OrganizerProposal>(
      '/assistant/organize',
      { method: 'POST', body: JSON.stringify({ rawNotes }), signal },
      true,
    ),
  elders: (signal?: AbortSignal) => request<Elder[]>('/elders', { signal }),
  walks: (signal?: AbortSignal) => request<Walk[]>('/walks', { signal }),
  plants: (signal?: AbortSignal) => request<Plant[]>('/plants', { signal }),
  createElder: (body: ElderInput) =>
    request<Elder>('/elders', { method: 'POST', body: JSON.stringify(body) }),
  updateElder: (id: number, body: ElderInput) =>
    request<Elder>(`/elders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createWalk: (body: WalkInput) =>
    request<Omit<Walk, 'plant_count'>>('/walks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createPlant: (body: PlantInput) =>
    request<Plant>('/plants', { method: 'POST', body: JSON.stringify(body) }),
  updatePlant: (id: number, body: PlantInput) =>
    request<Plant>(`/plants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deletePlant: (id: number) =>
    request<void>(`/plants/${id}`, { method: 'DELETE' }),
};
