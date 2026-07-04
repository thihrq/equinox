import { ErrorRequestHandler, Request, Response } from 'express';
import { appConfig } from '../config/env';

function isJsonSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError && 'body' in error;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'ROUTE_NOT_FOUND',
    message: 'Rota não encontrada.',
    method: req.method,
    path: req.originalUrl,
    ...(appConfig.isProduction ? {} : { hint: 'Verifique se a URL da API e o prefixo /api estão corretos.' }),
  });
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : 'Erro interno inesperado.';

  if (!appConfig.isProduction) {
    console.error('[Equinox] Unhandled error:', error);
  }

  if (isJsonSyntaxError(error)) {
    res.status(400).json({
      code: 'INVALID_JSON',
      message: 'JSON inválido no corpo da requisição.',
      ...(appConfig.isProduction ? {} : { error: message }),
    });
    return;
  }

  if (message.startsWith('Origem não permitida pelo CORS')) {
    res.status(403).json({
      code: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'Origem não permitida pelo CORS.',
      ...(appConfig.isProduction ? {} : { error: message }),
    });
    return;
  }

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor.',
    ...(appConfig.isProduction ? {} : { error: message }),
  });
};
