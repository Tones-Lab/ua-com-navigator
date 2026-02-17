import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { hasPatchOps, upsertAdvancedFlowOverrideEntry } from './advancedFlowUtils';
import type { FlowNode } from './flowUtils';

type AdvancedFlowScope = 'object' | 'global';

type AdvancedFlowTarget = {
  scope: AdvancedFlowScope;
  objectName?: string;
  method?: string;
} | null;

type AdvancedFlowBaseline =
  | {
      scope: 'global';
      pre: string;
      post: string;
    }
  | {
      scope: 'object';
      objectName: string;
      object: string;
    }
  | null;

type UseAdvancedFlowOrchestrationParams = {
  selectedFile: unknown;
  builderTarget: { panelKey: string; field: string } | null;
  getObjectByPanelKey: (panelKey: string) => Record<string, unknown> | null | undefined;
  getOverrideMethod: () => string;
  getOverrideEntry: (params: {
    objectName?: string;
    scope: 'pre' | 'post';
    method: string;
  }) => Record<string, unknown> | undefined;
  buildFlowNodesFromProcessors: (processors: unknown[]) => FlowNode[];
  buildFlowProcessors: (nodes: FlowNode[]) => Record<string, unknown>[];
  setAdvancedFlowNotice: (value: string | null) => void;
  setShowAdvancedFlowJsonPreview: (value: boolean) => void;
  setSaveError: (value: string | null) => void;
  setGlobalPreFlow: Dispatch<SetStateAction<FlowNode[]>>;
  setGlobalPostFlow: Dispatch<SetStateAction<FlowNode[]>>;
  setAdvancedFlow: Dispatch<SetStateAction<FlowNode[]>>;
  setAdvancedFlowBaseline: (value: AdvancedFlowBaseline) => void;
  setAdvancedFlowTarget: (value: AdvancedFlowTarget) => void;
  setAdvancedProcessorScope: (scope: AdvancedFlowScope) => void;
  setAdvancedProcessorSearch: (value: string) => void;
  setAdvancedFlowFocusTarget: (value: string | null) => void;
  setAdvancedFlowFocusIndex: (value: number) => void;
  setAdvancedFlowFocusOnly: (value: boolean) => void;
  setAdvancedFlowDefaultTarget: (value: string | null) => void;
  setFlowEditor: (value: null) => void;
  setFlowEditorDraft: (value: null) => void;
  ensureEditPermission: () => boolean;
  advancedFlowTarget: AdvancedFlowTarget;
  pendingOverrideSave: unknown[] | null;
  getBaseOverrides: () => unknown[];
  advancedProcessorScope: AdvancedFlowScope;
  globalPreFlow: FlowNode[];
  globalPostFlow: FlowNode[];
  advancedFlow: FlowNode[];
  setPendingOverrideSave: (value: unknown[]) => void;
  triggerToast: (message: string, pulse?: boolean) => void;
};

export default function useAdvancedFlowOrchestration(
  params: UseAdvancedFlowOrchestrationParams,
) {
  const openAdvancedFlowModal = useCallback(
    (
      scope: AdvancedFlowScope,
      objectNameOverride?: string | null,
      focusTargetField?: string | null,
    ): boolean => {
      if (!params.selectedFile) {
        return false;
      }
      params.setAdvancedFlowNotice(null);
      params.setShowAdvancedFlowJsonPreview(false);
      const getObjectName = (): string | null => {
        if (scope === 'global') {
          return null;
        }
        if (objectNameOverride) {
          return objectNameOverride;
        }
        if (params.builderTarget?.panelKey) {
          const name = params.getObjectByPanelKey(params.builderTarget.panelKey)?.['@objectName'];
          return typeof name === 'string' ? name : null;
        }
        return null;
      };
      const objectName = getObjectName();
      if (scope === 'object' && !objectName) {
        params.setSaveError('Select an object to open Advanced Flow.');
        return false;
      }
      const method = params.getOverrideMethod();
      if (scope === 'global') {
        const preEntry = params.getOverrideEntry({ scope: 'pre', method });
        const postEntry = params.getOverrideEntry({ scope: 'post', method });
        const preProcessors = Array.isArray(preEntry?.processors) ? preEntry.processors : [];
        const postProcessors = Array.isArray(postEntry?.processors) ? postEntry.processors : [];
        if (hasPatchOps(preProcessors) || hasPatchOps(postProcessors)) {
          params.setSaveError('Advanced Flow only supports v2 processor overrides.');
          return false;
        }
        const preNodes = params.buildFlowNodesFromProcessors(preProcessors);
        const postNodes = params.buildFlowNodesFromProcessors(postProcessors);
        params.setGlobalPreFlow(preNodes);
        params.setGlobalPostFlow(postNodes);
        params.setAdvancedFlow([]);
        params.setAdvancedFlowBaseline({
          scope: 'global',
          pre: JSON.stringify(params.buildFlowProcessors(preNodes)),
          post: JSON.stringify(params.buildFlowProcessors(postNodes)),
        });
      } else if (objectName) {
        const entry = params.getOverrideEntry({ objectName, scope: 'post', method });
        const processors = Array.isArray(entry?.processors) ? entry.processors : [];
        if (hasPatchOps(processors)) {
          params.setSaveError('Advanced Flow only supports v2 processor overrides.');
          return false;
        }
        const nodes = params.buildFlowNodesFromProcessors(processors);
        params.setAdvancedFlow(nodes);
        params.setAdvancedFlowBaseline({
          scope: 'object',
          objectName,
          object: JSON.stringify(params.buildFlowProcessors(nodes)),
        });
      }
      params.setAdvancedFlowTarget({ scope, objectName: objectName || undefined, method });
      params.setAdvancedProcessorScope(scope);
      params.setAdvancedProcessorSearch('');
      params.setAdvancedFlowFocusTarget(focusTargetField || null);
      params.setAdvancedFlowFocusIndex(0);
      params.setAdvancedFlowFocusOnly(false);
      params.setAdvancedFlowDefaultTarget(focusTargetField || null);
      params.setFlowEditor(null);
      params.setFlowEditorDraft(null);
      params.setSaveError(null);
      return true;
    },
    [params],
  );

  const saveAdvancedFlow = useCallback(() => {
    if (!params.ensureEditPermission()) {
      return;
    }
    if (!params.advancedFlowTarget) {
      params.setSaveError('Select a target before saving Advanced Flow.');
      return;
    }
    const method = params.advancedFlowTarget.method || params.getOverrideMethod();
    let baseOverrides =
      params.pendingOverrideSave ? [...params.pendingOverrideSave] : [...params.getBaseOverrides()];

    if (params.advancedProcessorScope === 'global') {
      const preProcessors = params.buildFlowProcessors(params.globalPreFlow);
      const postProcessors = params.buildFlowProcessors(params.globalPostFlow);
      baseOverrides = upsertAdvancedFlowOverrideEntry({
        baseOverrides,
        method,
        scope: 'pre',
        processors: preProcessors,
      });
      baseOverrides = upsertAdvancedFlowOverrideEntry({
        baseOverrides,
        method,
        scope: 'post',
        processors: postProcessors,
      });
      params.setAdvancedFlowBaseline({
        scope: 'global',
        pre: JSON.stringify(preProcessors),
        post: JSON.stringify(postProcessors),
      });
      const count = preProcessors.length + postProcessors.length;
      params.triggerToast(
        count === 0
          ? 'Cleared global Advanced Flow processors (staged).'
          : `Staged ${count} global Advanced Flow processor${count === 1 ? '' : 's'}.`,
        true,
      );
    } else {
      const objectName = params.advancedFlowTarget.objectName;
      if (!objectName) {
        params.setSaveError('Select an object before saving Advanced Flow.');
        return;
      }
      const processors = params.buildFlowProcessors(params.advancedFlow);
      baseOverrides = upsertAdvancedFlowOverrideEntry({
        baseOverrides,
        method,
        objectName,
        scope: 'post',
        processors,
      });
      params.setAdvancedFlowBaseline({
        scope: 'object',
        objectName,
        object: JSON.stringify(processors),
      });
      const count = processors.length;
      params.triggerToast(
        count === 0
          ? `Cleared Advanced Flow processors for ${objectName} (staged).`
          : `Staged ${count} Advanced Flow processor${count === 1 ? '' : 's'} for ${objectName}.`,
        true,
      );
    }
    params.setPendingOverrideSave(baseOverrides);
    params.setSaveError(null);
  }, [params]);

  return {
    openAdvancedFlowModal,
    saveAdvancedFlow,
  };
}
