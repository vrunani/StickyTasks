// Fire confetti from anywhere: burst({ x, y, count, spread })
export function burst(detail) {
  window.dispatchEvent(new CustomEvent('confetti', { detail }));
}
