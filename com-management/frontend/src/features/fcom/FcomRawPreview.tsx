import type { ReactNode } from 'react';
import FcomMatchBar from './FcomMatchBar';

type FcomRawPreviewProps = {
  searchHighlightActive: boolean;
  highlightQuery: string | null;
  rawMatchPositions: number[];
  rawMatchIndex: number;
  handlePrevRawMatch: () => void;
  handleNextRawMatch: () => void;
  rawPreviewText: string;
  renderRawHighlightedText: (text: string, query: string) => ReactNode;
};

export default function FcomRawPreview({
  searchHighlightActive,
  highlightQuery,
  rawMatchPositions,
  rawMatchIndex,
  handlePrevRawMatch,
  handleNextRawMatch,
  rawPreviewText,
  renderRawHighlightedText,
}: FcomRawPreviewProps) {
  return (
    <div className="raw-view">
      {searchHighlightActive && highlightQuery && rawMatchPositions.length > 0 && (
        <FcomMatchBar
          label={`Raw match ${rawMatchIndex + 1} of ${rawMatchPositions.length}`}
          onPrev={handlePrevRawMatch}
          onNext={handleNextRawMatch}
        />
      )}
      <pre className="raw-preview">
        {renderRawHighlightedText(rawPreviewText, highlightQuery || '')}
      </pre>
    </div>
  );
}
