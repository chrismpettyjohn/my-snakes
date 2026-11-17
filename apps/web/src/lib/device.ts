import {api} from './api';
import type {AssignSensorInput, DeviceList} from '@snake/shared';

export const fetchDevices = (homeId: string) => api<DeviceList>(`/homes/${homeId}/devices`);

export const assignSensor = (input: AssignSensorInput) => api('/sensor-assignments', {method: 'PUT', body: input});
