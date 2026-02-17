import type { ReactNode } from 'react';

type TableSortButtonProps = {
  label: ReactNode;
  sortKey: string;
  activeKey: string;
  direction: 'asc' | 'desc';
  onToggle: (key: any) => void;
};

export default function TableSortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onToggle,
}: TableSortButtonProps) {
  const indicator = activeKey === sortKey ? (direction === 'asc' ? '↑' : '↓') : null;

  return (
    <button type="button" className="table-sort-button" onClick={() => onToggle(sortKey)}>
      {label} {indicator}
    </button>
  );
}
