import {api} from '../lib/api';
import {A} from '@solidjs/router';
import {Icon} from '../lib/icons';
import {plural} from '../lib/format';
import {EmptyScene, SnakePic} from '../lib/art';
import type {Snake, SnakeStatus} from '@snake/shared';
import {QuickLog} from '../components/snake/QuickLog';
import {SnakeForm} from '../components/snake/SnakeForm';
import {SnakeSheet} from '../components/snake/SnakeSheet';
import {storage, createStoredSignal} from '../lib/storage';
import {VIEWS, Zones, isView} from '../components/snake/Zones';
import {createReorder} from '../components/snake/createReorder';
import {CollectionSwitch} from '../components/snake/CollectionSwitch';
import {FormSheet, PageHead, Section, Sheet, formValue} from '../lib/ui';
import {ZonePicker, type ZonePick} from '../components/snake/ZonePicker';
import {currentHome, homeId, homes, isOwner, refetchHomes} from '../lib/home';
import {CollectionIconPicker} from '../components/snake/CollectionIconPicker';
import {createMemo, createResource, createSignal, For, onCleanup, Show} from 'solid-js';

const STATUS_REFRESH_MS = 30_000;
const COLLAPSED_KEY = 'collapsed';

export default function Snakes() {
  const [status, {refetch: refetchStatus}] = createResource(homeId, id => api<SnakeStatus[]>(`/homes/${id}/status`));
  const [snakes, {refetch: refetchSnakes}] = createResource(homeId, id => api<Snake[]>(`/homes/${id}/snakes`));
  const timer = setInterval(refetchStatus, STATUS_REFRESH_MS);
  onCleanup(() => clearInterval(timer));
  const refresh = () => {
    void refetchStatus();
    void refetchSnakes();
  };
  const byId = createMemo(() => new Map((snakes() ?? []).map(a => [a.id, a])));

  const [openId, setOpenId] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);
  const [renaming, setRenaming] = createSignal(false);
  const [pick, setPick] = createSignal<ZonePick | null>(null);

  const [collapsed, setCollapsed] = createSignal(new Set(storage.getJson<string[]>(COLLAPSED_KEY, [])));
  const toggle = (id: string) => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
    storage.setJson(COLLAPSED_KEY, [...next]);
  };
  const [view, setView] = createStoredSignal('view', 'full', isView);
  const viewIdx = () => VIEWS.findIndex(v => v.id === view());
  const nextView = () => VIEWS[(viewIdx() + 1) % VIEWS.length]!;

  let rowsEl!: HTMLDivElement;
  const reorder = createReorder({
    items: () => status() ?? [],
    container: () => rowsEl,
    save: async ids => {
      await api(`/homes/${homeId()}/snakes/order`, {method: 'PUT', body: {ids}});
      await refetchStatus();
      void refetchSnakes();
    },
  });
  const focusRow = (id: string) => rowsEl.querySelector<HTMLElement>(`.snake-row[data-id="${id}"] .snake-toggle`)?.focus();

  const alerting = () => status()?.filter(s => s.alerts.length).length ?? 0;
  const summary = () => {
    const n = status()?.length;
    if (!n) return undefined;
    return (
      <>
        {plural(n, 'snake')} · {alerting() ? `${alerting()} need${alerting() === 1 ? 's' : ''} attention` : 'all good'}
      </>
    );
  };

  const otherHomes = () => homes()?.filter(h => h.id !== homeId()) ?? [];
  async function move(snake: Snake, toId: string) {
    const to = otherHomes().find(h => h.id === toId);
    if (!to || !confirm(`Move ${snake.name} to ${to.name}?`)) return false;
    await api(`/snakes/${snake.id}/home`, {method: 'PUT', body: {homeId: to.id}});
    refresh();
    return true;
  }

  return (
    <>
      <PageHead
        small
        sub={summary()}
        lead={<CollectionSwitch />}
        title={
          <span class="coll-title">
            <span
              class={isOwner() ? 'renamable' : ''}
              title={isOwner() ? 'Rename collection' : undefined}
              onClick={() => isOwner() && setRenaming(true)}
            >
              {currentHome()?.name ?? 'Your snakes'}
            </span>
            <Show when={status()?.length}>
              <span class={`status-dot ${alerting() ? 'bad' : ''}`} />
            </Show>
          </span>
        }
      >
        <Show when={status()?.length}>
          <button
            type="button"
            class="btn gray round"
            onClick={() => setView(nextView().id)}
            aria-label={`${VIEWS[viewIdx()]!.label} view. Switch to ${nextView().label.toLowerCase()} view`}
            title={`${VIEWS[viewIdx()]!.label} view`}
          >
            {VIEWS[viewIdx()]!.icon()}
          </button>
        </Show>
        <button class="btn round" onClick={() => setAdding(true)} aria-label="Add snake" title="Add snake">
          {Icon.plus()}
        </button>
      </PageHead>

      <Show when={status()?.length === 0}>
        <div class="empty">
          <EmptyScene />
          <h2>Add your first snake</h2>
          <p>
            Give it a name, then link its warm side, cold side, basking and RHP sensors in <A href="/settings">Settings</A>.
          </p>
          <button class="btn" onClick={() => setAdding(true)}>
            Add snake
          </button>
        </div>
      </Show>

      <div class={`rows ${view()}`} ref={rowsEl}>
        <For each={reorder.rows()}>
          {s => (
            <section data-id={s.id} class={`snake-row ${s.alerts.length ? 'alerting' : ''} ${reorder.dragId() === s.id ? 'dragging' : ''}`}>
              <div
                class={`snake-head ${collapsed().has(s.id) ? 'collapsed' : ''}`}
                onPointerDown={e => reorder.press(e, s.id)}
                onContextMenu={e => reorder.dragId() && e.preventDefault()}
              >
                <button type="button" class="snake-open" aria-label={`Open ${s.name}`} onClick={() => !reorder.wasDragged() && setOpenId(s.id)}>
                  <SnakePic s={s} size={44} sad={s.alerts.length > 0} />
                </button>
                <button
                  type="button"
                  class="snake-toggle"
                  aria-expanded={!collapsed().has(s.id)}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onClick={() => !reorder.wasDragged() && toggle(s.id)}
                  onKeyDown={e => reorder.keyMove(e, s.id, focusRow)}
                >
                  <span class="snake-name">
                    <span class="name">{s.name}</span>
                  </span>
                  <span class="sub">{s.species || 'Species not set'}</span>
                </button>
                <QuickLog snakeId={s.id} name={s.name} onLogged={refetchStatus} />
              </div>
              <Show when={!collapsed().has(s.id)}>
                <Zones
                  s={s}
                  snake={byId().get(s.id)}
                  view={view()}
                  onPick={role => setPick({s, role})}
                  onOpen={() => setOpenId(s.id)}
                  onLogged={refetchStatus}
                />
              </Show>
            </section>
          )}
        </For>
      </div>

      <SnakeSheet
        status={status()?.find(s => s.id === openId())}
        snake={openId() ? byId().get(openId()!) : undefined}
        onClose={() => setOpenId(null)}
        onChange={refresh}
        onPick={(s, role) => setPick({s, role})}
      />
      <ZonePicker pick={pick()} onClose={() => setPick(null)} onChange={refresh} />
      <FormSheet
        open={renaming()}
        title="Collection"
        onClose={() => setRenaming(false)}
        onSubmit={async e => {
          await api(`/homes/${homeId()}`, {
            method: 'PUT',
            body: {name: formValue(e, 'name'), icon: formValue(e, 'icon'), color: formValue(e, 'color')},
          });
          await refetchHomes();
          setRenaming(false);
        }}
        after={
          <Section
            title={plural(snakes()?.length ?? 0, 'Snake')}
            foot={otherHomes().length ? undefined : 'Create another collection in Settings to move snakes between them.'}
          >
            <For
              each={snakes()}
              fallback={
                <div class="cell">
                  <span class="muted">No snakes yet</span>
                </div>
              }
            >
              {sn => (
                <div class="cell">
                  <SnakePic s={sn} size={32} />
                  <span class="grow">
                    <span class="title">{sn.name}</span>
                    <span class="detail">{sn.species || 'Species not set'}</span>
                  </span>
                  <Show when={otherHomes().length}>
                    <select
                      aria-label={`Move ${sn.name} to another collection`}
                      onChange={e => {
                        const el = e.currentTarget;
                        move(sn, el.value).then(
                          ok => {
                            if (!ok) el.value = '';
                          },
                          (err: Error) => {
                            el.value = '';
                            alert(err.message);
                          },
                        );
                      }}
                    >
                      <option value="">Move to…</option>
                      <For each={otherHomes()}>{h => <option value={h.id}>{h.name}</option>}</For>
                    </select>
                  </Show>
                </div>
              )}
            </For>
          </Section>
        }
      >
        <CollectionIconPicker name={currentHome()?.name} icon={currentHome()?.icon} color={currentHome()?.color} />
      </FormSheet>
      <Sheet open={adding()} onClose={() => setAdding(false)} title="New Snake">
        <SnakeForm
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      </Sheet>
    </>
  );
}
