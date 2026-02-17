import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { findNodeById, replaceNodeById, type FlowNode } from './flowUtils';

export type FlowEditorScope = 'object' | 'global';
export type FlowEditorLane = 'object' | 'pre' | 'post';

export type FlowEditorState = {
  scope: FlowEditorScope;
  lane: FlowEditorLane;
  nodeId: string;
  setNodesOverride?: Dispatch<SetStateAction<FlowNode[]>>;
};

type FlowStateByLane = {
  nodes: FlowNode[];
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
};

export default function useFlowEditorState(
  getFlowStateByLane: (scope: FlowEditorScope, lane: FlowEditorLane) => FlowStateByLane,
) {
  const [flowEditor, setFlowEditor] = useState<FlowEditorState | null>(null);
  const [flowEditorDraft, setFlowEditorDraft] = useState<FlowNode | null>(null);

  const openFlowEditor = useCallback(
    (
      nodeId: string,
      scope: FlowEditorScope,
      lane: FlowEditorLane,
      nodesOverride?: FlowNode[],
      setNodesOverride?: Dispatch<SetStateAction<FlowNode[]>>,
    ) => {
      const nodes = nodesOverride || getFlowStateByLane(scope, lane).nodes;
      const node = findNodeById(nodes, nodeId);
      if (!node) {
        return;
      }
      setFlowEditor({ scope, lane, nodeId, setNodesOverride });
      setFlowEditorDraft(JSON.parse(JSON.stringify(node)) as FlowNode);
    },
    [getFlowStateByLane],
  );

  const handleCancelFlowEditor = useCallback(() => {
    setFlowEditor(null);
    setFlowEditorDraft(null);
  }, []);

  const handleSaveFlowEditor = useCallback(() => {
    if (!flowEditor || !flowEditorDraft) {
      return;
    }
    const setNodes =
      flowEditor.setNodesOverride || getFlowStateByLane(flowEditor.scope, flowEditor.lane).setNodes;
    setNodes((prev) => replaceNodeById(prev, flowEditor.nodeId, flowEditorDraft));
    setFlowEditor(null);
    setFlowEditorDraft(null);
  }, [flowEditor, flowEditorDraft, getFlowStateByLane]);

  return {
    flowEditor,
    setFlowEditor,
    flowEditorDraft,
    setFlowEditorDraft,
    openFlowEditor,
    handleCancelFlowEditor,
    handleSaveFlowEditor,
  };
}
