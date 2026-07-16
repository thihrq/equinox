import mongoose, { Schema, Document } from 'mongoose';

export interface IActiveV2RuntimeTelemetryEvent extends Document {
  eventId: string;
  occurredAt: Date;
  requestId: string;
  format: string;
  teamIdentity: string;
  archetype: string;
  publishRunId: string | null;
  activeV2DataDigest: string | null;
  baseline: {
    outcome: 'success' | 'error';
    latencyMs: number;
  };
  v2: {
    outcome: 'success' | 'error' | 'timeout' | 'skipped';
    latencyMs: number | null;
    fallbackTriggered: boolean;
    fallbackReason: string | null;
  };
  comparison: {
    classification: string;
    scoreDelta: number | null;
  } | null;
}

const ActiveV2RuntimeTelemetryEventSchema = new Schema<IActiveV2RuntimeTelemetryEvent>({
  eventId: { type: String, required: true, unique: true, index: true },
  occurredAt: { type: Date, required: true, index: true },
  requestId: { type: String, required: true, index: true },
  format: { type: String, required: true, index: true },
  teamIdentity: { type: String, required: true, index: true },
  archetype: { type: String, required: true, index: true },
  publishRunId: { type: String, default: null, index: true },
  activeV2DataDigest: { type: String, default: null },
  baseline: {
    outcome: { type: String, enum: ['success', 'error'], required: true },
    latencyMs: { type: Number, required: true },
  },
  v2: {
    outcome: { type: String, enum: ['success', 'error', 'timeout', 'skipped'], required: true },
    latencyMs: { type: Number, default: null },
    fallbackTriggered: { type: Boolean, required: true },
    fallbackReason: { type: String, default: null },
  },
  comparison: {
    type: {
      classification: { type: String, required: true },
      scoreDelta: { type: Number, default: null },
    },
    default: null,
  },
}, {
  timestamps: false,
});

export const ActiveV2RuntimeTelemetryEvent = mongoose.model<IActiveV2RuntimeTelemetryEvent>(
  'ActiveV2RuntimeTelemetryEvent',
  ActiveV2RuntimeTelemetryEventSchema,
  'active_v2_runtime_telemetry'
);
