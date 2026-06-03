import { useEffect, useRef, useCallback } from 'react';

interface DraftData {
  [key: string]: string;
}

interface UseDraftAutosaveOptions {
  key: string;
  data: DraftData;
  /**
   * The values currently persisted in the database. The draft is only kept in
   * localStorage when `data` actually DIFFERS from this baseline — this prevents
   * a freshly-loaded copy from being cached as a "draft" and then shadowing
   * newer database updates made from another device/browser.
   */
  baseline: DraftData | null;
  /** Only start autosaving once the baseline has been loaded. */
  enabled?: boolean;
  debounceMs?: number;
}

const normalize = (value: string | undefined) => (value ?? '').trim();

const draftsAreEqual = (a: DraftData, b: DraftData) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (normalize(a[key]) !== normalize(b[key])) return false;
  }
  return true;
};

export const useDraftAutosave = ({
  key,
  data,
  baseline,
  enabled = true,
  debounceMs = 1500,
}: UseDraftAutosaveOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<DraftData>(data);
  const baselineRef = useRef<DraftData | null>(baseline);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  const writeDraft = useCallback(
    (draft: DraftData) => {
      const base = baselineRef.current;

      // Without a known database baseline we cannot tell a genuine unsaved edit
      // apart from clean DB-loaded data, so never persist a draft yet.
      if (!base) return;

      // If the current data matches the database, there is nothing to recover —
      // remove any stale draft so it can't shadow future DB updates.
      if (draftsAreEqual(draft, base)) {
        localStorage.removeItem(key);
        return;
      }

      const hasContent = Object.values(draft).some(
        (value) => value && value.trim() !== ''
      );

      if (hasContent) {
        localStorage.setItem(key, JSON.stringify(draft));
      } else {
        localStorage.removeItem(key);
      }
    },
    [key]
  );

  const saveDraft = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      writeDraft(dataRef.current);
    }, debounceMs);
  }, [debounceMs, writeDraft]);

  // Save on data change (only once the baseline is known)
  useEffect(() => {
    if (!enabled || !baseline) return;
    saveDraft();
  }, [data, baseline, enabled, saveDraft]);

  // Flush draft immediately when the user leaves the tab/window
  useEffect(() => {
    const flush = () => {
      if (!enabled) return;
      writeDraft(dataRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [enabled, writeDraft]);

  // Clear draft (call after successful save)
  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [key]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { clearDraft };
};
