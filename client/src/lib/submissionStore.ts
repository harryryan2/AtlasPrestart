// Client-side submission store — now backed by the Express API + SQLite.
// All records are stored server-side and shared across every device.

import { apiRequest } from "./queryClient";

export async function saveSubmission(data: any): Promise<any> {
  const res = await apiRequest("POST", "/api/prestarts", data);
  const json = await res.json();
  return json.data;
}

export async function getSubmissions(): Promise<any[]> {
  const res = await apiRequest("GET", "/api/prestarts");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function deleteSubmission(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/prestarts/${id}`);
}
