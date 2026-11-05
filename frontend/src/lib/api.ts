import { DatasetSummary, ChatResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadDataset(file: File): Promise<DatasetSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed with status ${res.status}`);
  }

  return res.json();
}

export async function getCurrentDataset(): Promise<DatasetSummary> {
  const res = await fetch(`${API_BASE_URL}/api/dataset/current`);
  if (!res.ok) {
    throw new Error('No dataset currently loaded');
  }
  return res.json();
}

export async function activateTable(tableName: string): Promise<DatasetSummary> {
  const res = await fetch(`${API_BASE_URL}/api/tables/${encodeURIComponent(tableName)}/activate`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to activate table ${tableName}`);
  }
  return res.json();
}

export async function deleteTable(tableName: string): Promise<DatasetSummary | null> {
  const res = await fetch(`${API_BASE_URL}/api/tables/${encodeURIComponent(tableName)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete table ${tableName}`);
  }
  const data = await res.json();
  return data.active_dataset || null;
}

export async function sendChatMessage(
  datasetId: string,
  message: string,
  history: { role: string; content: string }[] = []
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataset_id: datasetId,
      message,
      history,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat request failed: ${res.statusText}`);
  }

  return res.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
