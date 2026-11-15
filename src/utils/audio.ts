let ctx: AudioContext | null = null;

/**
 * Tiếng "ting-ting" tổng hợp bằng Web Audio API (không cần file âm thanh).
 * Hai nốt bell-like cách nhau ~180ms, có overtone nhẹ để nghe trong trẻo.
 */
export function playTingTing(): void {
  if (typeof window === "undefined") return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;

  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();

  const audio = ctx;
  const start = audio.currentTime + 0.02;

  const strike = (freq: number, at: number, peak: number, decay: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  };

  const notes = [
    { f: 1318.5, t: 0 }, // E6
    { f: 1760.0, t: 0.18 }, // A6
  ];

  notes.forEach(({ f, t }) => {
    const at = start + t;
    strike(f, at, 0.32, 0.9); // thân nốt
    strike(f * 2.76, at, 0.06, 0.35); // overtone kim loại nhẹ
  });
}
