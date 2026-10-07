import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useNotebook } from '../api/notebook';
import type { Plant } from '../api/types';
import { FormError } from './NotebookUi';
import { useSubmission } from './useSubmission';

export function DeletePlantDialog({
  plant,
  onClose,
}: {
  plant: Plant;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { forgetPlant, announce } = useNotebook();
  const navigate = useNavigate();
  const { busy, error, submit } = useSubmission();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="dialog"
      ref={dialog}
      aria-labelledby="delete-heading"
      aria-describedby="delete-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="delete-heading">Delete this plant?</h2>
      <p id="delete-description">
        “{plant.local_name}” and its follow-up questions will be permanently
        removed from this notebook. This cannot be undone.
      </p>
      <FormError message={error} />
      <div className="action-row">
        <button
          autoFocus
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Keep plant
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={() =>
            void submit(async () => {
              await api.deletePlant(plant.id);
              forgetPlant(plant.id);
              announce('The plant and its follow-up questions were deleted.');
              navigate('/herbarium');
            })
          }
        >
          {busy ? 'Deleting…' : 'Delete plant'}
        </button>
      </div>
    </dialog>
  );
}
