import { useEffect, useRef, useState } from 'react';

type UseStagedReviewUiStateParams = {
  hasEditPermission: boolean;
  hasStagedChanges: boolean;
  stagedSectionTitles: string[];
};

export default function useStagedReviewUiState({
  hasEditPermission,
  hasStagedChanges,
  stagedSectionTitles,
}: UseStagedReviewUiStateParams) {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStep, setReviewStep] = useState<'review' | 'commit'>('review');
  const [reviewCtaPulse, setReviewCtaPulse] = useState(false);
  const [expandedOriginals, setExpandedOriginals] = useState<Record<string, boolean>>({});
  const [stagedSectionOpen, setStagedSectionOpen] = useState<Record<string, boolean>>({});

  const reviewModalOpenRef = useRef(false);
  const reviewPulseIntervalRef = useRef<number | null>(null);
  const reviewPulseTimeoutRef = useRef<number | null>(null);
  const stagedPulseActiveRef = useRef(false);

  useEffect(() => {
    if (!hasStagedChanges || !hasEditPermission) {
      if (reviewPulseIntervalRef.current) {
        window.clearInterval(reviewPulseIntervalRef.current);
        reviewPulseIntervalRef.current = null;
      }
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
        reviewPulseTimeoutRef.current = null;
      }
      stagedPulseActiveRef.current = false;
      setReviewCtaPulse(false);
      return;
    }

    const triggerPulse = () => {
      setReviewCtaPulse(true);
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
      }
      reviewPulseTimeoutRef.current = window.setTimeout(() => {
        setReviewCtaPulse(false);
      }, 1400);
    };

    if (!stagedPulseActiveRef.current) {
      triggerPulse();
      stagedPulseActiveRef.current = true;
    }

    if (!reviewPulseIntervalRef.current) {
      reviewPulseIntervalRef.current = window.setInterval(triggerPulse, 6000);
    }

    return () => {
      if (reviewPulseIntervalRef.current) {
        window.clearInterval(reviewPulseIntervalRef.current);
        reviewPulseIntervalRef.current = null;
      }
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
        reviewPulseTimeoutRef.current = null;
      }
      stagedPulseActiveRef.current = false;
      setReviewCtaPulse(false);
    };
  }, [hasStagedChanges, hasEditPermission]);

  useEffect(() => {
    if (!showReviewModal || reviewStep !== 'review') {
      reviewModalOpenRef.current = false;
      return;
    }
    if (reviewModalOpenRef.current) {
      return;
    }
    reviewModalOpenRef.current = true;
    const openByDefault = stagedSectionTitles.length === 1;
    const next: Record<string, boolean> = {};
    stagedSectionTitles.forEach((title) => {
      next[title] = openByDefault;
    });
    setStagedSectionOpen(next);
    setExpandedOriginals({});
  }, [showReviewModal, reviewStep, stagedSectionTitles]);

  return {
    showReviewModal,
    setShowReviewModal,
    reviewStep,
    setReviewStep,
    reviewCtaPulse,
    setReviewCtaPulse,
    expandedOriginals,
    setExpandedOriginals,
    stagedSectionOpen,
    setStagedSectionOpen,
  };
}
