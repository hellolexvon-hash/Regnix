/**
 * validationStore.ts
 *
 * Persistent validation workflow store.
 * Keeps the UI unchanged while persisting:
 *   - current validation route (landing / level1 / level2 / level3)
 *   - uploaded document metadata
 *   - actual uploaded files in IndexedDB so refresh does not lose them
 *   - signature / approval state
 *   - backend snapshot in /api/validation/state
 *
 * Public API stays compatible with the existing components:
 *   - useValidationStore()
 *   - levelStates / uploadedDocs / signatureUrl / submittedAt / isApproved
 *   - setLevelState / setUploadedDocs / setSignatureUrl / setSubmittedAt /
 *     setApproved / resetAll
 *
 * Additional fields are exposed for the validation orchestrator only:
 *   - currentRoute
 *   - companyName
 *   - selectedActs
 *   - liveRegisterFile
 *   - validationSessionId
 *   - hydrated
 *   - setCurrentRoute / setCompanyName / setSelectedActs / setLiveRegisterFile
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type LevelState = 'pending' | 'active' | 'done' | 'waiting';
export type ValidationRoute = 'landing' | 'level1' | 'level2' | 'level3';

export interface SheetPreview {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

export interface UploadedDoc {
  id: string;
  file: File;
  name: string;
  fixed: boolean;
  sheets?: SheetPreview[];
}

interface Store {
  levelStates: [LevelState, LevelState, LevelState];
  uploadedDocs: UploadedDoc[];
  signatureUrl: string;
  submittedAt: Date | null;
  isApproved: boolean;

  currentRoute: ValidationRoute;
  companyName: string;
  selectedActs: string[];
  liveRegisterFile: File | null;
  validationSessionId: string | null;
}

interface PersistedUploadedDoc {
  id: string;
  name: string;
  fixed: boolean;
  sheetCount: number;
  sheetNames: string[];
  fileName?: string | null;
  fileType?: string | null;
}

interface PersistedStore {
  levelStates: [LevelState, LevelState, LevelState];
  uploadedDocs: PersistedUploadedDoc[];
  signatureUrl: string;
  submittedAt: string | null;
  isApproved: boolean;

  currentRoute: ValidationRoute;
  companyName: string;
  selectedActs: string[];
  liveRegisterFileName: string | null;
  liveRegisterFileType: string | null;
  validationSessionId: string | null;
  updatedAt: string;
}

type Listener = () => void;

let _currentUserId: string | null = null;
let _currentContactEmail: string | null = null;

const STORAGE_KEY_PREFIX = 'regnix.validation.store.v2';
const API_ENDPOINT = '/api/validation/state';

const DEFAULT_STORE: Store = {
  levelStates: ['pending', 'pending', 'pending'],
  uploadedDocs: [],
  signatureUrl: '',
  submittedAt: null,
  isApproved: false,

  currentRoute: 'landing',
  companyName: '',
  selectedActs: [],
  liveRegisterFile: null,
  validationSessionId: null,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function cloneDefaultStore(): Store {
  return {
    levelStates: [...DEFAULT_STORE.levelStates] as [LevelState, LevelState, LevelState],
    uploadedDocs: [],
    signatureUrl: '',
    submittedAt: null,
    isApproved: false,
    currentRoute: 'landing',
    companyName: '',
    selectedActs: [],
    liveRegisterFile: null,
    validationSessionId: null,
  };
}

let _store: Store = cloneDefaultStore();
let _hydrated = false;
let _hydratedScope: string | null = null;
let _hydratingPromise: Promise<void> | null = null;
const _listeners = new Set<Listener>();

function notify() {
  for (const listener of _listeners) {
    try {
      listener();
    } catch {
      // ignore a single broken subscriber
    }
  }
}

function makeStorageKey(scope: string): string {
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

function getScopeKey(userId?: string | null, email?: string | null): string {
  const uid = typeof userId === 'string' && userId.trim() ? userId.trim() : '';
  if (uid) return uid;
  const mail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : '';
  if (mail) return mail;
  return 'anonymous';
}

function asValidationRoute(value: unknown): ValidationRoute {
  return value === 'level1' || value === 'level2' || value === 'level3' || value === 'landing'
    ? value
    : 'landing';
}

function asLevelStates(value: unknown): [LevelState, LevelState, LevelState] {
  const fallback: [LevelState, LevelState, LevelState] = ['pending', 'pending', 'pending'];
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  const allowed: LevelState[] = ['pending', 'active', 'done', 'waiting'];
  return [
    allowed.includes(value[0]) ? value[0] : 'pending',
    allowed.includes(value[1]) ? value[1] : 'pending',
    allowed.includes(value[2]) ? value[2] : 'pending',
  ];
}

function createPersistedSnapshot(store: Store): PersistedStore {
  return {
    levelStates: store.levelStates,
    uploadedDocs: store.uploadedDocs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      fixed: doc.fixed,
      sheetCount: doc.sheets?.length ?? 0,
      sheetNames: doc.sheets?.map((sheet) => sheet.name) ?? [],
      fileName: doc.file.name,
      fileType: doc.file.type || null,
    })),
    signatureUrl: store.signatureUrl,
    submittedAt: store.submittedAt ? store.submittedAt.toISOString() : null,
    isApproved: store.isApproved,
    currentRoute: store.currentRoute,
    companyName: store.companyName,
    selectedActs: [...store.selectedActs],
    liveRegisterFileName: store.liveRegisterFile?.name ?? null,
    liveRegisterFileType: store.liveRegisterFile?.type ?? null,
    validationSessionId: store.validationSessionId,
    updatedAt: new Date().toISOString(),
  };
}

function applyPersistedSnapshot(snapshot: Partial<PersistedStore>) {
  _store = {
    ..._store,
    levelStates: asLevelStates(snapshot.levelStates),
    signatureUrl: typeof snapshot.signatureUrl === 'string' ? snapshot.signatureUrl : _store.signatureUrl,
    submittedAt: typeof snapshot.submittedAt === 'string' && snapshot.submittedAt
      ? new Date(snapshot.submittedAt)
      : null,
    isApproved: typeof snapshot.isApproved === 'boolean' ? snapshot.isApproved : _store.isApproved,
    currentRoute: asValidationRoute(snapshot.currentRoute),
    companyName: typeof snapshot.companyName === 'string' ? snapshot.companyName : _store.companyName,
    selectedActs: Array.isArray(snapshot.selectedActs)
      ? snapshot.selectedActs.filter((v): v is string => typeof v === 'string')
      : _store.selectedActs,
    validationSessionId: typeof snapshot.validationSessionId === 'string' ? snapshot.validationSessionId : _store.validationSessionId,
  };
}

function storageGet(scope: string): PersistedStore | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(makeStorageKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedStore;
  } catch {
    return null;
  }
}

function storageSet(scope: string, snapshot: PersistedStore) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(makeStorageKey(scope), JSON.stringify(snapshot));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

function storageRemove(scope: string) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(makeStorageKey(scope));
  } catch {
    // ignore
  }
}

type FileRecord = {
  scope: string;
  key: string;
  file: Blob;
  fileName: string;
  fileType: string;
  updatedAt: string;
};

const DB_NAME = 'regnix_validation_files';
const DB_VERSION = 1;
const FILE_STORE = 'files';

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !('indexedDB' in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const store = db.createObjectStore(FILE_STORE, { keyPath: ['scope', 'key'] });
        store.createIndex('scope', 'scope', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function putFile(scope: string, key: string, file: Blob, fileName: string, fileType: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).put({
      scope,
      key,
      file,
      fileName,
      fileType,
      updatedAt: new Date().toISOString(),
    } satisfies FileRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function getFile(scope: string, key: string): Promise<{ blob: Blob; fileName: string; fileType: string } | null> {
  const db = await openDb();
  if (!db) return null;
  const record = await new Promise<FileRecord | undefined>((resolve) => {
    const tx = db.transaction(FILE_STORE, 'readonly');
    const req = tx.objectStore(FILE_STORE).get([scope, key]);
    req.onsuccess = () => resolve(req.result as FileRecord | undefined);
    req.onerror = () => resolve(undefined);
  });
  db.close();
  if (!record) return null;
  return { blob: record.file, fileName: record.fileName, fileType: record.fileType };
}

async function clearScopeFiles(scope: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    const store = tx.objectStore(FILE_STORE);
    const idx = store.index('scope');
    const range = IDBKeyRange.only(scope);
    const req = idx.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function reviveUploadedDocs(scope: string, docs: PersistedUploadedDoc[]): Promise<UploadedDoc[]> {
  const revived: UploadedDoc[] = [];

  for (const meta of docs) {
    const fileRecord = await getFile(scope, `doc:${meta.id}`);
    let file: File;

    if (fileRecord) {
      file = new File([fileRecord.blob], meta.fileName ?? fileRecord.fileName ?? meta.name, {
        type: fileRecord.fileType || fileRecord.blob.type || 'application/octet-stream',
      });
    } else {
      file = new File([''], meta.fileName ?? meta.name, {
        type: meta.fileType ?? 'application/octet-stream',
      });
    }

    revived.push({
      id: meta.id,
      file,
      name: meta.name,
      fixed: meta.fixed,
      sheets: meta.sheetNames.length ? meta.sheetNames.map((name) => ({ name, headers: [], rows: [] })) : undefined,
    });
  }

  return revived;
}

async function reviveLiveRegisterFile(scope: string, fileName: string | null, fileType: string | null): Promise<File | null> {
  if (!fileName) return null;
  const record = await getFile(scope, 'live-register');
  if (record) {
    return new File([record.blob], fileName, {
      type: fileType || record.fileType || record.blob.type || 'application/octet-stream',
    });
  }
  return new File([''], fileName, { type: fileType || 'application/octet-stream' });
}


// Signature of every file already written to IndexedDB, so a state change
// never re-writes unchanged files (this was the main source of lag).
const _persistedSigs = new Map<string, string>();
const fileSig = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

async function persistFilesToBrowser(scope: string, store: Store) {
  if (!isBrowser()) return;

  for (const doc of store.uploadedDocs) {
    const key = `${scope}:doc:${doc.id}`;
    const sig = fileSig(doc.file);
    if (_persistedSigs.get(key) === sig) continue;
    _persistedSigs.set(key, sig);
    await putFile(scope, `doc:${doc.id}`, doc.file, doc.file.name, doc.file.type || 'application/octet-stream');
  }

  if (store.liveRegisterFile) {
    const key = `${scope}:live-register`;
    const sig = fileSig(store.liveRegisterFile);
    if (_persistedSigs.get(key) !== sig) {
      _persistedSigs.set(key, sig);
      await putFile(
        scope,
        'live-register',
        store.liveRegisterFile,
        store.liveRegisterFile.name,
        store.liveRegisterFile.type || 'application/octet-stream',
      );
    }
  }
}

async function chooseNewestSnapshot(
  localSnapshot: PersistedStore | null,
  remoteSnapshot: PersistedStore | null,
): Promise<PersistedStore | null> {
  if (!localSnapshot && !remoteSnapshot) return null;
  if (!localSnapshot) return remoteSnapshot;
  if (!remoteSnapshot) return localSnapshot;

  const localDate = Date.parse(localSnapshot.updatedAt || '');
  const remoteDate = Date.parse(remoteSnapshot.updatedAt || '');
  if (Number.isFinite(remoteDate) && remoteDate > localDate) return remoteSnapshot;
  return localSnapshot;
}

async function hydrateFromBackendOrStorage(scope: string): Promise<void> {
  if (_hydratedScope === scope && _hydrated) return;
  if (_hydratingPromise) return _hydratingPromise;

  _hydratingPromise = (async () => {
    const localSnapshot = storageGet(scope);

    let remoteSnapshot: PersistedStore | null = null;
    if (typeof fetch === 'function') {
      try {
        const url = new URL(API_ENDPOINT, window.location.origin);
        url.searchParams.set('scope', scope);
        if (_currentUserId) url.searchParams.set('userId', _currentUserId);
        const res = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          remoteSnapshot = payload?.state ?? null;
        }
      } catch {
        remoteSnapshot = null;
      }
    }

    const selected = await chooseNewestSnapshot(localSnapshot, remoteSnapshot);
    if (selected) {
      applyPersistedSnapshot(selected);
      _store.uploadedDocs = await reviveUploadedDocs(scope, selected.uploadedDocs ?? []);
      _store.liveRegisterFile = await reviveLiveRegisterFile(
        scope,
        selected.liveRegisterFileName ?? null,
        selected.liveRegisterFileType ?? null,
      );
      _hydrated = true;
      _hydratedScope = scope;
      notify();
      return;
    }

    _store = cloneDefaultStore();
    _hydrated = true;
    _hydratedScope = scope;
    notify();
  })().finally(() => {
    _hydratingPromise = null;
  });

  return _hydratingPromise;
}

async function syncStoreToBackend(scope: string, snapshot: PersistedStore): Promise<void> {
  if (!isBrowser() || typeof fetch !== 'function') return;

  try {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope,
        userId: _currentUserId,
        contactEmail: _currentContactEmail,
        ...snapshot,
      }),
    });
  } catch {
    // Silent fallback.
  }
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _backendTimer: ReturnType<typeof setTimeout> | null = null;

function persistStore(scope: string, syncBackend = true) {
  const snapshot = createPersistedSnapshot(_store);
  storageSet(scope, snapshot);
  void persistFilesToBrowser(scope, _store);
  if (syncBackend) {
    // Debounce the network call: many setters can fire in one tick.
    if (_backendTimer) clearTimeout(_backendTimer);
    _backendTimer = setTimeout(() => {
      void syncStoreToBackend(scope, createPersistedSnapshot(_store));
    }, 500);
  }
}

function schedulePersist(scope: string) {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => persistStore(scope), 120);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof File !== 'undefined' && a instanceof File && b instanceof File) {
    return fileSig(a) === fileSig(b);
  }
  return false;
}

function setField<K extends keyof Store>(scope: string, key: K, value: Store[K]) {
  // No-op when nothing changed — prevents notify/persist loops from effects.
  if (sameValue(_store[key], value)) return;
  _store = { ..._store, [key]: value };
  notify();
  schedulePersist(scope);
}

function setUploadedDocsInternal(scope: string, docs: UploadedDoc[]) {
  _store = { ..._store, uploadedDocs: docs };
  notify();
  schedulePersist(scope);
}

async function ensureHydrated(scope: string) {
  if (!_hydrated || _hydratedScope !== scope) {
    await hydrateFromBackendOrStorage(scope);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable actions — created ONCE, so their identity never changes between
// renders. Components can safely list them in useEffect dependency arrays
// (previously new functions on every render caused an endless
// effect → setState → re-render loop).
// ─────────────────────────────────────────────────────────────────────────────
let _scope = 'anonymous';

const ACTIONS = {
  setLevelState(level: 0 | 1 | 2, state: LevelState) {
    const next = [..._store.levelStates] as [LevelState, LevelState, LevelState];
    next[level] = state;
    setField(_scope, 'levelStates', next);
  },
  setUploadedDocs(docs: UploadedDoc[]) {
    setUploadedDocsInternal(_scope, docs);
  },
  setSignatureUrl(url: string) {
    setField(_scope, 'signatureUrl', url);
  },
  setSubmittedAt(date: Date | null) {
    setField(_scope, 'submittedAt', date);
  },
  setApproved(val: boolean) {
    setField(_scope, 'isApproved', val);
  },
  setCurrentRoute(route: ValidationRoute) {
    setField(_scope, 'currentRoute', route);
  },
  setCompanyName(name: string) {
    setField(_scope, 'companyName', name);
  },
  setSelectedActs(acts: string[]) {
    setField(_scope, 'selectedActs', acts);
  },
  setLiveRegisterFile(file: File | null) {
    setField(_scope, 'liveRegisterFile', file);
  },
  setValidationSessionId(id: string | null) {
    setField(_scope, 'validationSessionId', id);
  },
  async reload() {
    await hydrateFromBackendOrStorage(_scope);
    notify();
  },
  resetAll() {
    _store = cloneDefaultStore();
    _hydrated = true;
    _hydratedScope = _scope;
    _persistedSigs.clear();
    storageRemove(_scope);
    void clearScopeFiles(_scope);
    notify();
    persistStore(_scope);
  },
};

export function useValidationStore() {
  const { user, profile, loading: authLoading } = useAuth();
  const scope = getScopeKey(user?.id ?? null, profile?.email ?? user?.email ?? null);
  _scope = scope;
  _currentUserId = user?.id ?? null;
  _currentContactEmail = profile?.email ?? user?.email ?? null;
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender((n) => n + 1);
    _listeners.add(listener);

    if (!authLoading) {
      // hydrateFromBackendOrStorage() already calls notify() when it finishes,
      // so no extra notify / forceRender is needed here.
      void ensureHydrated(scope);
    }

    return () => {
      _listeners.delete(listener);
    };
  }, [authLoading, scope]);

  useEffect(() => {
    if (authLoading) return;

    const seededCompanyName =
      profile?.company_name?.trim() ||
      profile?.firm_name?.trim() ||
      profile?.full_name?.trim() ||
      '';
    if (seededCompanyName && !_store.companyName) {
      _store = { ..._store, companyName: seededCompanyName };
      persistStore(scope, false);
    }
  }, [authLoading, profile, scope]);

  return {
    ..._store,
    hydrated: _hydrated && _hydratedScope === scope && !authLoading,
    ...ACTIONS,
  };
}
