import {onCleanup} from 'solid-js';

export function onDismiss(root: () => HTMLElement | undefined, close: () => void) {
  const onPress = (e: Event) => {
    const el = root();
    if (el && !el.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('pointerdown', onPress);
  document.addEventListener('keydown', onKey);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onPress);
    document.removeEventListener('keydown', onKey);
  });
}
