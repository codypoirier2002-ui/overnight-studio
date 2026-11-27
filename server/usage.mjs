// Daily call budget, persisted to server/.usage.json so restarts don't reset it.
import fs from "node:fs";
import path from "node:path";

export function createUsage({ file, cap, coderCap }) {
  let data = { day: "", calls: 0, coderCalls: 0 };
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    /* first run */
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const roll = () => {
    if (data.day !== today()) data = { day: today(), calls: 0, coderCalls: 0 };
  };
  const save = () => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save usage file:", e.message);
    }
  };
  return {
    /** Reserve one call. Returns null if allowed, or the reason it isn't. */
    take(kind) {
      roll();
      if (data.calls >= cap) return "daily_cap";
      if (kind === "coder" && data.coderCalls >= coderCap) return "daily_coder_cap";
      data.calls++;
      if (kind === "coder") data.coderCalls++;
      save();
      return null;
    },
    snapshot() {
      roll();
      return { day: data.day, calls: data.calls, cap, coderCalls: data.coderCalls, coderCap };
    },
  };
}
