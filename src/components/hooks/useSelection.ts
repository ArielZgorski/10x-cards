import { useState, useCallback } from 'react';

export function useSelection<T extends string>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: T) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const getSelectedArray = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  const hasSelection = selectedIds.size > 0;
  const selectionCount = selectedIds.size;

  return {
    selectedIds,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
    getSelectedArray,
    hasSelection,
    selectionCount,
  };
}
