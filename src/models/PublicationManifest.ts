import mongoose, { Schema, Document } from 'mongoose';

export interface PublicationSetTransition {
  setId: string;
  previousPublishRunId: string | null;
  newPublishRunId: string;
}

export type PublicationManifestStatus =
  | 'prepared'
  | 'published'
  | 'active'
  | 'rolled-back'
  | 'failed';

export interface IPublicationManifest extends Document {
  publishRunId: string;
  previousActivePublishRunId: string | null;
  sourceActiveRunId: string;
  setIds: string[];
  recordCount: number;
  activeV2DataDigest: string;
  acceptanceReportDigest: string;
  shadowEvidenceDigest: string;
  baselineSourceDigest: string;
  status: PublicationManifestStatus;
  setTransitions: PublicationSetTransition[];
  publishedAt: Date;
  updatedAt: Date;
}

const PublicationSetTransitionSchema = new Schema<PublicationSetTransition>({
  setId: { type: String, required: true },
  previousPublishRunId: { type: String, default: null },
  newPublishRunId: { type: String, required: true },
}, { _id: false });

const PublicationManifestSchema = new Schema<IPublicationManifest>({
  publishRunId: { type: String, required: true, unique: true, index: true },
  previousActivePublishRunId: { type: String, default: null, index: true },
  sourceActiveRunId: { type: String, required: true, index: true },
  setIds: [{ type: String, required: true }],
  recordCount: { type: Number, required: true },
  activeV2DataDigest: { type: String, required: true },
  acceptanceReportDigest: { type: String, required: true },
  shadowEvidenceDigest: { type: String, required: true },
  baselineSourceDigest: { type: String, required: true },
  status: {
    type: String,
    enum: ['prepared', 'published', 'active', 'rolled-back', 'failed'],
    required: true,
    index: true,
  },
  setTransitions: [PublicationSetTransitionSchema],
  publishedAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: { createdAt: 'publishedAt', updatedAt: 'updatedAt' }
});

export const PublicationManifest = mongoose.model<IPublicationManifest>(
  'PublicationManifest',
  PublicationManifestSchema,
  'publication_manifests'
);
