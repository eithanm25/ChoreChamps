import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Replaces window.confirm with the app's own themed ConfirmDialog. Usage:
 *
 *   const { requestConfirm, confirmDialog } = useConfirmDialog();
 *   ...
 *   requestConfirm('האם למחוק?', () => doTheDelete());
 *   ...
 *   return <>{confirmDialog}{...rest of the component}</>;
 *
 * onConfirm only ever fires after the user picks the confirm button — never
 * synchronously, unlike window.confirm, so callers must not expect a return
 * value from requestConfirm itself.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<{ message: string; onConfirm: () => void; options?: ConfirmOptions } | null>(null);

  const requestConfirm = (message: string, onConfirm: () => void, options?: ConfirmOptions) => {
    setPending({ message, onConfirm, options });
  };

  const confirmDialog = pending ? (
    <ConfirmDialog
      message={pending.message}
      confirmLabel={pending.options?.confirmLabel}
      cancelLabel={pending.options?.cancelLabel}
      danger={pending.options?.danger}
      onConfirm={() => {
        const { onConfirm } = pending;
        setPending(null);
        onConfirm();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { requestConfirm, confirmDialog };
}
