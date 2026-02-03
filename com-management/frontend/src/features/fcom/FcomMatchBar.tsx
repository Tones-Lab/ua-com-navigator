import React from 'react';

type FcomMatchBarProps = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  children?: React.ReactNode;
};

export default function FcomMatchBar({ label, onPrev, onNext, children }: FcomMatchBarProps) {
  return (
    <div className="match-bar">
      <span className="match-label">{label}</span>
      {children}
      <div className="match-actions">
        <button type="button" className="match-button" onClick={onPrev}>
          Prev
        </button>
        <button type="button" className="match-button" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
