/**
 * validationStore.ts
 *
 * Lightweight in-memory store (no Redux/Zustand needed) for the validation
 * workflow state. Because ValidationPage re-mounts on each URL change, state
 * must live outside React. This module exports a hook backed by a module-level
 * singleton so data persists across /level1 → /landing → /level2 navigations
 * within the same browser session.
 *
 * If you add a proper state management library later, replace this with a slice.
 */

import { useState, useEffect } from 'react';

export type LevelState = 'pending' | 'active' | 'done' | 'waiting';

export interface UploadedDoc {
  id:      string;
  file:    File;
  name:    string;
  fixed:   boolean;
  sheets?: SheetPreview[];
}

export interface SheetPreview {
  name:    string;
  headers: string[];
  rows:    (string | number | null)[][];
}

// ── Singleton store ───────────────────────────────────────────────────────────

interface Store {
  levelStates:  [LevelState, LevelState, LevelState];
  uploadedDocs: UploadedDoc[];
  signatureUrl: string;
  submittedAt:  Date | null;
  isApproved:   boolean;
}

let _store: Store = {
  levelStates:  ['pending', 'pending', 'pending'],
  uploadedDocs: [],
  signatureUrl: '',
  submittedAt:  null,
  isApproved:   false,
};

type Listener = () => void;
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach(fn => fn());
}

function setField<K extends keyof Store>(key: K, value: Store[K]) {
  _store = { ..._store, [key]: value };
  notify();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useValidationStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return {
    ..._store,

    setLevelState(level: 0 | 1 | 2, state: LevelState) {
      const next: [LevelState, LevelState, LevelState] = [..._store.levelStates] as [LevelState, LevelState, LevelState];
      next[level] = state;
      setField('levelStates', next);
    },

    setUploadedDocs(docs: UploadedDoc[]) {
      setField('uploadedDocs', docs);
    },

    setSignatureUrl(url: string) {
      setField('signatureUrl', url);
    },

    setSubmittedAt(date: Date | null) {
      setField('submittedAt', date);
    },

    setApproved(val: boolean) {
      setField('isApproved', val);
    },

    resetAll() {
      _store = {
        levelStates:  ['pending', 'pending', 'pending'],
        uploadedDocs: [],
        signatureUrl: '',
        submittedAt:  null,
        isApproved:   false,
      };
      notify();
    },
  };
}
