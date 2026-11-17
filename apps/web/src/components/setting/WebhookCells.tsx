import {api} from '../../lib/api';
import {Icon} from '../../lib/icons';
import {createSignal} from 'solid-js';
import {CopyCell} from '../../lib/ui';
import {createAction} from '../../lib/action';
import type {Device, UploadCredentials} from '@snake/shared';

export function WebhookCells(p: {d: Device; onRotated: () => void; onError: (msg: string) => void}) {
  const [creds, setCreds] = createSignal<UploadCredentials>({uploadUrl: p.d.uploadUrl!, apiKey: p.d.apiKey!});
  const {busy, run} = createAction();
  const rotate = async () => {
    p.onError('');
    try {
      setCreds(await api<UploadCredentials>(`/devices/${p.d.id}/rotate-key`, {method: 'POST'}));
      p.onRotated();
    } catch (e) {
      p.onError((e as Error).message);
    }
  };
  return (
    <>
      <CopyCell label="Webhook URL" value={creds().uploadUrl} />
      <CopyCell
        label="Webhook API Key"
        value={creds().apiKey}
        extra={
          <button
            type="button"
            class={`icon-btn ${busy() ? 'spin' : ''}`}
            aria-label="Rotate API key"
            title="Rotate API key"
            disabled={busy()}
            onClick={() => run(rotate)}
          >
            {Icon.rotate()}
          </button>
        }
      />
    </>
  );
}
