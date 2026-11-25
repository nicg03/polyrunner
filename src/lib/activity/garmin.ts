import type { ActivityProvider } from "./types";

/** Stub — wire real Garmin OAuth later. */
export const garminActivityProvider: ActivityProvider = {
  id: "garmin",
  label: "Garmin (prossimamente)",
  async connect() {
    return { error: "Integrazione Garmin non ancora attiva. Usa Demo per testare." };
  },
  async disconnect() {},
  async syncWeek() {
    throw new Error("Garmin non collegato");
  },
};
