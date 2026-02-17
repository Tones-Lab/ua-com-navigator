import { useState } from 'react';

type SortDirection = 'asc' | 'desc';

type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
};

export default function useSortableTable<K extends string>(initialSort: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initialSort);

  const toggleSort = (key: K) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  };

  const getSortIndicator = (key: K) => {
    if (sort.key !== key) {
      return null;
    }
    return sort.direction === 'asc' ? '↑' : '↓';
  };

  return {
    sort,
    setSort,
    toggleSort,
    getSortIndicator,
  };
}
