import { apiClient } from './client.ts';

export interface LicenseStatus {
  active:               boolean;
  expired:              boolean;
  fingerprint_mismatch: boolean;
  machine_id:           string;
  license?: {
    type:           string;
    type_label:     string;
    customer_name:  string;
    issued_at:      string;
    expires_at:     string | null;
    days_remaining: number | null;
    machine_bound:  boolean;
  };
}

export const licenseApi = {
  getStatus: () =>
    apiClient.get<LicenseStatus & { success: boolean }>('/license/status'),

  getMachineId: () =>
    apiClient.get<{ success: boolean; machine_id: string }>('/license/machine-id'),

  activate: (licenseKey: string, bindToMachine = true) =>
    apiClient.post<{ success: boolean; message: string; license?: LicenseStatus['license'] }>(
      '/license/activate',
      { license_key: licenseKey, bind_to_machine: bindToMachine }
    ),

  getInfo: () =>
    apiClient.get<{ success: boolean; status: LicenseStatus; history: unknown[] }>('/license/info'),

  deactivate: () =>
    apiClient.delete<{ success: boolean; message: string }>('/license'),
};
