// Studio sounds, synthesised with WebAudio (nothing to download). Quiet by
// design, created lazily on the first user gesture so browsers allow it.

type Voice = [OscillatorType | "noise", number, number, number, number, number?]; // type, f0, f1, dur, vol, delay

const SOUNDS: Record<string, Voice[]> = {
  "blip-designer": [["triangle", 660, 760, 0.07, 0.5]],
  "blip-coder": [["square", 330, 300, 0.05, 0.22]],
  "blip-artist": [["sine", 880, 990, 0.08, 0.5]],
  "blip-tester": [["triangle", 520, 900, 0.07, 0.45]],
  stage: [["sine", 523, 523, 0.18, 0.5], ["sine", 784, 784, 0.3, 0.45, 0.12]],
  debate: [["square", 520, 380, 0.09, 0.18], ["square", 420, 300, 0.12, 0.18, 0.1]],
  bug: [["sine", 280, 720, 0.12, 0.5], ["sine", 720, 200, 0.2, 0.45, 0.12]],
  ship: [
    ["square", 523, 523, 0.11, 0.18], ["square", 659, 659, 0.11, 0.18, 0.12], ["square", 784, 784, 0.11, 0.18, 0.24],
    ["square", 1046, 1046, 0.35, 0.18, 0.36], ["triangle", 262, 262, 0.6, 0.4, 0.36],
  ],
  kettle: [["sine", 1700, 1900, 0.5, 0.08]],
  sip: [["noise", 0, 0, 0.12, 0.12]],
  type: [["noise", 0, 0, 0.02, 0.2], ["noise", 0, 0, 0.02, 0.16, 0.07], ["noise", 0, 0, 0.02, 0.2, 0.15]],
  click: [["triangle", 900, 700, 0.04, 0.3]],
  pop: [["sine", 400, 900, 0.08, 0.35]],
};

export class StudioSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;

  constructor() {
    const unlock = () => {
      this.ensure();
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  private ensure(): void {
    if (this.ctx || !this.enabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  play(name: string): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== "running") return;
    const voices = SOUNDS[name];
    if (!voices) return;
    const now = this.ctx.currentTime;
    for (const [type, f0, f1, dur, vol, delay = 0] of voices) {
      const t0 = now + delay;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(this.master);
      if (type === "noise") {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = name === "sip" ? 900 : 3000;
        src.connect(f);
        f.connect(g);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      } else {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
        o.connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
      }
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.ensure();
    if (this.ctx) {
      if (on) void this.ctx.resume();
      else void this.ctx.suspend();
    }
  }
}
