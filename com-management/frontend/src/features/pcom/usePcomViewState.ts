import { useEffect, useMemo } from 'react';

type PcomObjectEntry = {
  key: string;
  name: string;
  obj: any;
};

type UsePcomViewStateArgs = {
  activeApp: string;
  rawPreviewText: string;
  pcomSelectedObjectKey: string | null;
  setPcomSelectedObjectKey: (value: string | null) => void;
};

export default function usePcomViewState({
  activeApp,
  rawPreviewText,
  pcomSelectedObjectKey,
  setPcomSelectedObjectKey,
}: UsePcomViewStateArgs) {
  const getPcomObjectName = (obj: any) => String(obj?.['@objectName'] || obj?.objectName || '');

  const pcomParsed = useMemo(() => {
    if (activeApp !== 'pcom') {
      return null;
    }
    const source = rawPreviewText.trim();
    if (!source || (!source.startsWith('{') && !source.startsWith('['))) {
      return null;
    }
    try {
      return JSON.parse(source);
    } catch {
      return null;
    }
  }, [activeApp, rawPreviewText]);

  const pcomObjectEntries = useMemo<PcomObjectEntry[]>(() => {
    const objects = Array.isArray(pcomParsed?.objects) ? pcomParsed.objects : [];
    return objects.map((obj: any, index: number) => {
      const name = getPcomObjectName(obj);
      return {
        key: name || `object-${index}`,
        name: name || `Object ${index + 1}`,
        obj,
      };
    });
  }, [pcomParsed]);

  const pcomSelectedObject = useMemo(() => {
    if (pcomObjectEntries.length === 0) {
      return null;
    }
    const match = pcomObjectEntries.find((entry) => entry.key === pcomSelectedObjectKey);
    return match || pcomObjectEntries[0];
  }, [pcomObjectEntries, pcomSelectedObjectKey]);

  useEffect(() => {
    if (activeApp !== 'pcom') {
      return;
    }
    if (pcomObjectEntries.length === 0) {
      if (pcomSelectedObjectKey) {
        setPcomSelectedObjectKey(null);
      }
      return;
    }
    if (
      !pcomSelectedObjectKey ||
      !pcomObjectEntries.some((entry) => entry.key === pcomSelectedObjectKey)
    ) {
      setPcomSelectedObjectKey(pcomObjectEntries[0].key);
    }
  }, [activeApp, pcomObjectEntries, pcomSelectedObjectKey, setPcomSelectedObjectKey]);

  return {
    pcomParsed,
    pcomObjectEntries,
    pcomSelectedObject,
  };
}
