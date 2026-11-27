// Studio life: what the crew gets up to between productions. Kettle runs,
// window gazing, watering Gerald, browsing the cartridge shelf, sipping from
// their mugs, and dozing at their desks in the small hours.

import { AGENT_ORDER, type AgentId } from "../agents";
import type { Activity, BubbleIcon, StudioScene } from "./scene";
import type { StudioSound } from "./sound";

interface Plan {
  activity: Activity;
  icon: BubbleIcon;
  stay: [number, number];
  weight: number;
}

export class StudioLife {
  private next: Record<AgentId, number> = { designer: 4, coder: 9, artist: 14, tester: 7 };
  private back: Partial<Record<AgentId, number>> = {};
  private wasBusy = false;
  private t = 0;
  private timer = 0;

  constructor(
    private scene: StudioScene,
    private busy: () => boolean,
    private sound: StudioSound,
  ) {}

  start(): void {
    this.timer = window.setInterval(() => this.tick(1), 1000);
  }

  stop(): void {
    window.clearInterval(this.timer);
  }

  private plans(hour: number): Plan[] {
    const late = hour >= 0 && hour < 5;
    return [
      { activity: "kettle", icon: "note", stay: [5, 9], weight: 3 },
      { activity: "window", icon: "heart", stay: [6, 12], weight: 2 },
      { activity: "plant", icon: "heart", stay: [5, 8], weight: 1.5 },
      { activity: "shelf", icon: "?", stay: [5, 9], weight: 1.5 },
      { activity: "meeting", icon: "talk", stay: [6, 10], weight: 1 },
      { activity: "sleep", icon: "zzz", stay: [15, 30], weight: late ? 4 : 0.2 },
    ];
  }

  tick(dt: number): void {
    if (document.hidden) return;
    this.t += dt;
    const busy = this.busy();
    if (busy) {
      this.back = {};
      this.wasBusy = true;
      // during a night: the occasional sip at the desk
      for (const id of AGENT_ORDER) {
        if (this.scene.activityOf(id) === "desk" && !this.scene.isWalking(id) && Math.random() < 0.05) {
          this.scene.sip(id);
          if (Math.random() < 0.3) this.sound.play("sip");
        }
      }
      return;
    }
    if (this.wasBusy) {
      // let the crew settle after shipping before wandering off
      this.wasBusy = false;
      for (const id of AGENT_ORDER) this.next[id] = this.t + 8 + Math.random() * 12;
    }
    const away = AGENT_ORDER.filter((id) => this.back[id] !== undefined).length;
    for (const id of AGENT_ORDER) {
      const due = this.back[id];
      if (due !== undefined) {
        if (this.t >= due) {
          delete this.back[id];
          this.scene.setActivity(id, "desk");
          this.next[id] = this.t + 8 + Math.random() * 20;
        }
        continue;
      }
      if (this.t < this.next[id]) continue;
      if (this.scene.activityOf(id) === "desk" && Math.random() < 0.5) {
        this.scene.sip(id);
        this.next[id] = this.t + 4 + Math.random() * 8;
        continue;
      }
      if (away >= 2) {
        this.next[id] = this.t + 5;
        continue;
      }
      const plan = this.pick(this.plans(this.scene.hour));
      this.scene.setActivity(id, plan.activity);
      this.scene.say(id, plan.icon, 2400);
      if (plan.activity === "kettle") window.setTimeout(() => this.sound.play("kettle"), 2500);
      this.back[id] = this.t + plan.stay[0] + Math.random() * (plan.stay[1] - plan.stay[0]) + (plan.activity === "sleep" ? 0 : 3);
      return; // one new outing per tick keeps things calm
    }
  }

  private pick(plans: Plan[]): Plan {
    const total = plans.reduce((n, p) => n + p.weight, 0);
    let r = Math.random() * total;
    for (const p of plans) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return plans[0];
  }
}
