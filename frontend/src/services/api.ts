const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://equinox-api-c7zy.onrender.com';

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

function resolveGatewayErrorCode(status: number): string | undefined {
  if (status === 502 || status === 503 || status === 504) return 'DEPLOYMENT_GATEWAY_ERROR';
  return undefined;
}

async function readErrorPayload(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (_error) {
      return {};
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text.slice(0, 280) } : {};
  } catch (_error) {
    return {};
  }
}

export async function apiPost<TResponse>(url: string, data: unknown): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(url), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw buildFetchError(error);
  }

  if (!response.ok) {
    const errorData = await readErrorPayload(response);
    const gatewayCode = resolveGatewayErrorCode(response.status);

    throw {
      response: {
        status: response.status,
        data: {
          ...errorData,
          code: typeof errorData.code === 'string' ? errorData.code : gatewayCode,
          message: typeof errorData.message === 'string' ? errorData.message : response.statusText,
        },
      },
      message: response.statusText,
    } satisfies ApiErrorShape;
  }

  return response.json() as Promise<TResponse>;
}
