/**
 * Whether the on-screen touch controls are up: the same rule `@arcade/input` mounts them by, the
 * shell's `?touch=1` or a coarse pointer. Title, select, How to Play and the race HUD all word their hints by it.
 */
export function isTouchScreen(): boolean {
  const forced = new URLSearchParams(window.location.search).get('touch') === '1';
  return forced || window.matchMedia('(pointer: coarse)').matches;
}

/** The on-screen B (burst) button the touch controls mount, or null when they aren't up. */
export function burstButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="touch-overlay"] button[data-action="burst"]');
}
