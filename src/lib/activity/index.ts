import { garminActivityProvider } from "./garmin";
import { mockActivityProvider } from "./mock";
import type { ActivityProvider } from "./types";

export * from "./types";
export { mockActivityProvider, getConnectedProviders, getWeekStats } from "./mock";

const providers: Record<string, ActivityProvider> = {
  mock: mockActivityProvider,
  garmin: garminActivityProvider,
};

export function getActivityProvider(id: string): ActivityProvider {
  return providers[id] ?? mockActivityProvider;
}

export function listActivityProviders(): ActivityProvider[] {
  return [mockActivityProvider, garminActivityProvider];
}
