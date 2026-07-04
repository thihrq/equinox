import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { appConfig } from '../config/env';
import { RecommendationCache } from '../equinox/cache/RecommendationCache';
import { DataPackRegistry } from '../equinox/data-packs/DataPackRegistry';
import { runFormatScopeAudit } from '../equinox/qa/FormatScopeAudit';

function getMongoStatus(): 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'unknown' {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}

function buildReleaseChecks() {
  const mongoStatus = getMongoStatus();
  const dataPackReport = new DataPackRegistry().buildReport();
  const formatScopeReport = runFormatScopeAudit();
  const hasBlockingDataPackFailure = dataPackReport.failingPacks.length > 0;
  const hasBlockingFormatFailure = formatScopeReport.status === 'fail';

  return {
    mongoStatus,
    dataPackReport,
    formatScopeReport,
    isReady: mongoStatus === 'connected' && !hasBlockingDataPackFailure && !hasBlockingFormatFailure,
    hasWarnings: dataPackReport.warnings.length > 0 || formatScopeReport.warnings.length > 0,
  };
}

export class SystemController {
  public static health(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      service: appConfig.appName,
      version: appConfig.version,
      environment: appConfig.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  public static readiness(_req: Request, res: Response): void {
    const releaseChecks = buildReleaseChecks();

    res.status(releaseChecks.isReady ? 200 : 503).json({
      status: releaseChecks.isReady ? 'ready' : 'not_ready',
      service: appConfig.appName,
      version: appConfig.version,
      checks: {
        mongo: releaseChecks.mongoStatus,
        dataPacks: releaseChecks.dataPackReport.overallStatus,
        dataPackFailures: releaseChecks.dataPackReport.failingPacks.length,
        formatScope: releaseChecks.formatScopeReport.status,
        formatScopeFailures: releaseChecks.formatScopeReport.failedChecks,
      },
      warnings: {
        dataPacks: releaseChecks.dataPackReport.warnings.length,
        formatScope: releaseChecks.formatScopeReport.warnings.length,
      },
      timestamp: new Date().toISOString(),
    });
  }

  public static dataPacks(_req: Request, res: Response): void {
    const dataPackReport = new DataPackRegistry().buildReport();

    res.status(200).json({
      status: dataPackReport.failingPacks.length > 0 ? 'warning' : 'ok',
      service: appConfig.appName,
      version: appConfig.version,
      dataPacks: dataPackReport,
      timestamp: new Date().toISOString(),
    });
  }

  public static formatScope(_req: Request, res: Response): void {
    const formatScopeReport = runFormatScopeAudit();

    res.status(formatScopeReport.status === 'fail' ? 500 : 200).json({
      status: formatScopeReport.status === 'fail' ? 'error' : formatScopeReport.status,
      service: appConfig.appName,
      version: appConfig.version,
      formatScope: formatScopeReport,
      timestamp: new Date().toISOString(),
    });
  }

  public static release(_req: Request, res: Response): void {
    const releaseChecks = buildReleaseChecks();

    res.status(releaseChecks.isReady ? 200 : 503).json({
      status: releaseChecks.isReady ? (releaseChecks.hasWarnings ? 'ready_with_warnings' : 'ready') : 'not_ready',
      release: 'Equinox v1.0',
      service: appConfig.appName,
      version: appConfig.version,
      environment: appConfig.nodeEnv,
      checks: {
        mongo: releaseChecks.mongoStatus,
        dataPacks: {
          status: releaseChecks.dataPackReport.overallStatus,
          total: releaseChecks.dataPackReport.totalPacks,
          failures: releaseChecks.dataPackReport.failingPacks.length,
          warnings: releaseChecks.dataPackReport.warnings.length,
        },
        formatScope: {
          status: releaseChecks.formatScopeReport.status,
          total: releaseChecks.formatScopeReport.totalChecks,
          failures: releaseChecks.formatScopeReport.failedChecks,
          warnings: releaseChecks.formatScopeReport.warningChecks,
        },
        cache: RecommendationCache.stats(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  public static status(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      service: appConfig.appName,
      version: appConfig.version,
      environment: appConfig.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      mongo: getMongoStatus(),
      cache: RecommendationCache.stats(),
      timestamp: new Date().toISOString(),
    });
  }
}
