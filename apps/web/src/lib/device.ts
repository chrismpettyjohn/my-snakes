import type { AssignSensorInput, DeviceList } from "@snake/shared";
import { api } from "./api";

export const fetchDevices = (homeId: string) => api<DeviceList>(`/homes/${homeId}/devices`);

/** Replaces the snakes (and zone) one device channel serves. */
export const assignSensor = (input: AssignSensorInput) => api("/sensor-assignments", { method: "PUT", body: input });
