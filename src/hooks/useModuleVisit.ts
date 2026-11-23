import { useEffect } from 'react';
import { useProgress } from '../context/ProgressContext';
import type { ModuleId } from '../types/modules';

export function useModuleVisit(id: ModuleId) {
  const { markVisited } = useProgress();
  useEffect(() => {
    markVisited(id);
  }, [id, markVisited]);
}
