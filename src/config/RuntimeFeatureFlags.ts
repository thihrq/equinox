export type ValidatedPackageMode = 'disabled' | 'validate-only' | 'shadow' | 'serve';

export interface RuntimeFeatureFlagsConfig {
  mode: ValidatedPackageMode;
  packagePath: string;
  expectedDigest: string;
  shadowSampleRate: number;
  failClosed: boolean;
  observabilityEnabled: boolean;
}

export class RuntimeFeatureFlags {
  private static instance: RuntimeFeatureFlags | null = null;
  private config: RuntimeFeatureFlagsConfig;

  private constructor() {
    const rawMode = process.env.EQUINOX_VALIDATED_PACKAGE_MODE || 'validate-only';
    const allowedModes: ValidatedPackageMode[] = ['disabled', 'validate-only', 'shadow', 'serve'];

    if (!allowedModes.includes(rawMode as ValidatedPackageMode)) {
      throw new Error(`UNKNOWN_FEATURE_FLAG_VALUE: Modo '${rawMode}' não é reconhecido para EQUINOX_VALIDATED_PACKAGE_MODE`);
    }

    this.config = {
      mode: rawMode as ValidatedPackageMode,
      packagePath:
        process.env.EQUINOX_VALIDATED_PACKAGE_PATH ||
        'artifacts/competitive-production-readiness/20260720T231346Z/validated-package',
      expectedDigest:
        process.env.EQUINOX_VALIDATED_PACKAGE_EXPECTED_DIGEST ||
        'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
      shadowSampleRate: Number(process.env.EQUINOX_VALIDATED_PACKAGE_SHADOW_SAMPLE_RATE || 1.0),
      failClosed: process.env.EQUINOX_VALIDATED_PACKAGE_FAIL_CLOSED !== 'false',
      observabilityEnabled: process.env.EQUINOX_VALIDATED_PACKAGE_OBSERVABILITY !== 'false',
    };
  }

  public static getInstance(): RuntimeFeatureFlags {
    if (!RuntimeFeatureFlags.instance) {
      RuntimeFeatureFlags.instance = new RuntimeFeatureFlags();
    }
    return RuntimeFeatureFlags.instance;
  }

  public getConfig(): RuntimeFeatureFlagsConfig {
    return { ...this.config };
  }

  public getMode(): ValidatedPackageMode {
    return this.config.mode;
  }

  public isFailClosed(): boolean {
    return this.config.failClosed;
  }
}
