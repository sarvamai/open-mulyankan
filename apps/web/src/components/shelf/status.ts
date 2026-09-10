/**
 * Ingest status, shared by every surface that shows an item's progress: the
 * knowledge base table and shelves, and the exam paper shelf.
 */

export type Status = 'ready' | 'processing' | 'failed';
export type EventState = 'completed' | 'running' | 'failed';

export interface StatusEvent {
  label: string;
  state: EventState;
  window: string;
  ago: string;
}
