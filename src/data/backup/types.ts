import type { CropPosition } from '../../types/index.ts'
import type { statusToDatabase } from '../remote/contracts.ts'

export type BackupStatus = (typeof statusToDatabase)[keyof typeof statusToDatabase]
export type CoverMime = 'image/jpeg' | 'image/png' | 'image/webp'
export interface BackupHousehold { id: string; name: string; originalCreatedAt: string; originalUpdatedAt: string }
export interface BackupProfile { id: string; name: string; sortOrder: number; archivedAt: string | null; originalCreatedAt: string; originalUpdatedAt: string }
export interface BackupBook {
  id: string; profileId: string; title: string; author: string; translator: string;
  status: BackupStatus; startedOn: string | null; finishedOn: string | null; rating: number | null; progressPercent: number | null;
  notes: string; cropPosition: CropPosition;
  cover: { originalPath: string; originalFilename: string; mimeType: CoverMime } | null;
  originalCreatedAt: string; originalUpdatedAt: string; deletedAt: string | null; deletedByOriginal: string | null;
}
export interface StructuredBackup {
  format: 'reading-shelf-structured-export'; formatVersion: 1 | 2; createdAt: string; coverFilesIncluded: false;
  household: BackupHousehold; profiles: BackupProfile[]; books: BackupBook[];
}
interface FileBase { path: string; size: number; sha256: string }
export type BackupFileEntry = (FileBase & { kind: 'data' }) | (FileBase & {
  kind: 'cover'; profileId: string; bookId: string; originalStoragePath: string;
  originalFilename: string | null; mimeType: CoverMime; referencedByBookId: string | null;
})
export interface BackupManifest {
  format: 'reading-shelf-backup'; formatVersion: 1 | 2; createdAt: string; backupStartedAt: string; backupCompletedAt: string;
  source: 'supabase'; household: { id: string; name: string };
  profileCount: number; bookCount: number; activeBookCount: number; softDeletedBookCount: number;
  coverFileCount: number; referencedCoverFileCount: number; historicalCoverFileCount: number;
  backupIncludes: ['structuredData', 'covers', 'softDeletedRecords', 'historicalOriginals'];
  hashAlgorithm: 'SHA-256'; restoreHistoricalCovers: 'keep-in-zip'; files: BackupFileEntry[];
}
export interface ValidatedBackup { manifest: BackupManifest; data: StructuredBackup; files: Map<string, Uint8Array>; identity: string }
export type BackupProgress = (message: string) => void
export interface RestoreFailure { stage: 'profiles' | 'books' | 'covers' | 'deletion' | 'verification'; oldId: string | null; message: string }
export interface RestoreResult {
  complete: boolean; profileCount: number; bookCount: number; softDeletedBookCount: number; coverCount: number;
  historicalCoversKeptInZip: number; householdMapping: { oldId: string; newId: string };
  profileMapping: Record<string, string>; bookMapping: Record<string, string>; failures: RestoreFailure[];
  originalHistory: { oldId: string; newId: string; originalCreatedAt: string; originalUpdatedAt: string; originalDeletedAt: string | null }[];
}
export const BACKUP_LIMITS = { zipBytes: 100 * 1024 * 1024, expandedBytes: 100 * 1024 * 1024,
  entries: 2500, jsonBytes: 8 * 1024 * 1024, manifestBytes: 2 * 1024 * 1024, coverBytes: 10 * 1024 * 1024,
  profiles: 100, books: 2000 } as const
export class BackupError extends Error { constructor(message: string) { super(message); this.name = 'BackupError' } }
