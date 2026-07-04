const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      code?: string;
      message?: string;
      error?: unknown;
      path?: string;
    };
  };
  message?: string;
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${API_BASE_URL}${normalizedPath.replace(/^\/api/, '')}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

function buildFetchError(error: unknown): ApiErrorShape {
  return {
    response: {
      status: 0,
      data: {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
      },
    },
    message: error instanceof Error ? error.message : 'Network request failed',
  };
}

export async function apiPost<TResponse>(url: string, data: unknown): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw buildFetchError(error);
  }

  if (!response.ok) {
    let errorData = {};

    try {
      errorData = await response.json();
    } catch (_error) {
      errorData = { message: response.statusText };
    }

    throw {
      response: {
        status: response.status,
        data: errorData,
      },
      message: response.statusText,
    } satisfies ApiErrorShape;
  }

  return response.json() as Promise<TResponse>;
}
