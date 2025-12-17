import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DraftData {
  [key: string]: string;
}

interface UseDraftAutosaveOptions {
  key: string;
  data: DraftData;
  setters: { [key: string]: (value: string) => void };
  onRestore?: () => void;
  debounceMs?: number;
}

export const useDraftAutosave = ({
  key,
  data,
  setters,
  onRestore,
  debounceMs = 1500,
}: UseDraftAutosaveOptions) => {
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);
  const initialDataRef = useRef<DraftData | null>(null);
  const dataRef = useRef<DraftData>(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const writeDraft = useCallback(
    (draft: DraftData) => {
      const hasContent = Object.values(draft).some(
        (value) => value && value.trim() !== ""
      );

      if (hasContent) {
        localStorage.setItem(key, JSON.stringify(draft));
      }
    },
    [key]
  );

  // Restore draft on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    
    const savedDraft = localStorage.getItem(key);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as DraftData;
        
        // Check if there's any actual content in the draft
        const hasContent = Object.values(parsed).some(value => value && value.trim() !== '');
        
        if (hasContent) {
          // Store initial data to compare later
          initialDataRef.current = parsed;
          
          // Apply all saved values
          Object.entries(parsed).forEach(([field, value]) => {
            if (setters[field] && value !== undefined) {
              setters[field](value);
            }
          });
          
          toast({
            title: "Rascunho recuperado",
            description: "Os dados que não foram salvos foram recuperados automaticamente.",
            duration: 5000,
          });
          
          onRestore?.();
        }
      } catch (error) {
        console.error('Error restoring draft:', error);
        localStorage.removeItem(key);
      }
    }
    hasRestoredRef.current = true;
  }, [key, setters, onRestore, toast]);

  // Auto-save with debounce
  const saveDraft = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      writeDraft(dataRef.current);
    }, debounceMs);
  }, [debounceMs, writeDraft]);

  // Save on data change
  useEffect(() => {
    if (hasRestoredRef.current) {
      saveDraft();
    }
  }, [data, saveDraft]);

  // Flush draft immediately when user leaves the tab/window (avoids losing text before debounce)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        writeDraft(dataRef.current);
      }
    };

    const handlePageHide = () => {
      writeDraft(dataRef.current);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [writeDraft]);

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
