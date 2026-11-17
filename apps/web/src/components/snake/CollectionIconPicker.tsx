import {createEffect, createSignal, For} from 'solid-js';
import {CollectionColor, CollectionIcon} from '@snake/shared';
import {COLLECTION_COLOR, COLLECTION_GLYPH, COLLECTION_ICON_LABEL, CollectionTile} from '../../lib/icons';

export function CollectionIconPicker(p: {name?: string; icon?: CollectionIcon; color?: CollectionColor}) {
  const [icon, setIcon] = createSignal<CollectionIcon>('house');
  const [color, setColor] = createSignal<CollectionColor>('indigo');
  createEffect(() => {
    setIcon(CollectionIcon.safeParse(p.icon).data ?? 'house');
    setColor(CollectionColor.safeParse(p.color).data ?? 'indigo');
  });

  return (
    <>
      <label class="cell">
        <CollectionTile icon={icon()} color={color()} />
        <input name="name" required maxLength={80} placeholder="Name" value={p.name ?? ''} autofocus />
      </label>
      <div class="cell coll-picker">
        <input type="hidden" name="icon" value={icon()} />
        <input type="hidden" name="color" value={color()} />
        <div class="coll-swatches" role="radiogroup" aria-label="Colour">
          <For each={CollectionColor.options}>
            {c => (
              <button
                type="button"
                role="radio"
                aria-checked={color() === c}
                aria-label={c}
                title={c}
                class={`coll-swatch ${color() === c ? 'on' : ''}`}
                style={{background: COLLECTION_COLOR[c]}}
                onClick={() => setColor(c)}
              />
            )}
          </For>
        </div>
        <div class="coll-glyphs" role="radiogroup" aria-label="Icon">
          <For each={CollectionIcon.options}>
            {g => (
              <button
                type="button"
                role="radio"
                aria-checked={icon() === g}
                class={`coll-glyph ${icon() === g ? 'on' : ''}`}
                onClick={() => setIcon(g)}
              >
                <span class="coll-glyph-ic" style={icon() === g ? {background: COLLECTION_COLOR[color()]} : undefined}>
                  {COLLECTION_GLYPH[g]()}
                </span>
                <span class="coll-glyph-label">{COLLECTION_ICON_LABEL[g]}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
