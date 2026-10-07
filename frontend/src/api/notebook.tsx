import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from './client';
import type { Elder, Plant, Walk } from './types';

interface Notebook {
  elders: Elder[];
  walks: Walk[];
  plants: Plant[];
  status: 'loading' | 'ready' | 'error';
  error: string;
  reload: () => void;
  keepElder: (elder: Elder) => void;
  keepWalk: (walk: Omit<Walk, 'plant_count'>) => void;
  keepPlant: (plant: Plant) => void;
  forgetPlant: (id: number) => void;
  notice: string;
  announce: (message: string) => void;
}

const NotebookContext = createContext<Notebook | null>(null);

function upsert<T extends { id: number }>(items: T[], item: T): T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

export function NotebookProvider({ children }: { children: ReactNode }) {
  const [elders, setElders] = useState<Elder[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [status, setStatus] = useState<Notebook['status']>('loading');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [notice, announce] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    Promise.all([
      api.elders(controller.signal),
      api.walks(controller.signal),
      api.plants(controller.signal),
    ])
      .then(([people, outings, specimens]) => {
        if (controller.signal.aborted) return;
        setElders(people);
        setWalks(outings);
        setPlants(specimens);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'The notebook could not be opened.',
        );
        setStatus('error');
      });
    return () => controller.abort();
  }, [revision]);

  const countedWalks = walks.map((walk) => ({
    ...walk,
    plant_count: plants.filter((plant) => plant.walk_id === walk.id).length,
  }));

  return (
    <NotebookContext.Provider
      value={{
        elders,
        walks: countedWalks,
        plants,
        status,
        error,
        notice,
        announce,
        reload: () => setRevision((value) => value + 1),
        keepElder: (elder) => setElders((items) => upsert(items, elder)),
        keepWalk: (walk) =>
          setWalks((items) => upsert(items, { ...walk, plant_count: 0 })),
        keepPlant: (plant) => setPlants((items) => upsert(items, plant)),
        forgetPlant: (id) =>
          setPlants((items) => items.filter((plant) => plant.id !== id)),
      }}
    >
      {children}
    </NotebookContext.Provider>
  );
}

export function useNotebook() {
  const notebook = useContext(NotebookContext);
  if (!notebook) throw new Error('NotebookProvider is required.');
  return notebook;
}
