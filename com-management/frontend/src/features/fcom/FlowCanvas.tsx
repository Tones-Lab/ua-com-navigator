import React from 'react';
import { removeNodeById, type FlowBranchPath, type FlowNode } from './flowUtils';
import type { FlowNodeErrorMap } from './flowValidation';

type FlowVersionInfo = {
  mode: 'none' | 'v2' | 'v3' | 'mixed';
  label: string;
  detail: string;
};

type FlowCanvasProps = {
  nodes: FlowNode[];
  path: FlowBranchPath;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  scope: 'object' | 'global';
  lane: 'object' | 'pre' | 'post';
  nodeErrorsMap?: FlowNodeErrorMap;
  versionInfo?: FlowVersionInfo | null;
  focusTarget: string | null;
  getFlowNodeLabel: (node: FlowNode) => string;
  nodeMatchesFocusTarget: (node: FlowNode, targetField: string | null) => boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (
    event: React.DragEvent<HTMLDivElement>,
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
  ) => void;
  onOpenEditor: (
    nodeId: string,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
    nodesOverride?: FlowNode[],
    setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>,
  ) => void;
};

const FlowCanvas = ({
  nodes,
  path,
  setNodes,
  scope,
  lane,
  nodeErrorsMap,
  versionInfo,
  focusTarget,
  getFlowNodeLabel,
  nodeMatchesFocusTarget,
  onDragOver,
  onDrop,
  onOpenEditor,
}: FlowCanvasProps) => (
  <div
    className={`flow-lane${focusTarget ? ' flow-lane-focused' : ''}`}
    onDragOver={onDragOver}
    onDrop={(event) => onDrop(event, path, setNodes, scope, lane)}
  >
    {nodes.length === 0 && <div className="flow-empty">Drop processors here</div>}
    {nodes.map((node) => {
      const isFocused = nodeMatchesFocusTarget(node, focusTarget);
      const versionMode = versionInfo?.mode;
      const showVersionBadge = scope === 'object' && versionMode && versionMode !== 'none';
      const isV3 = versionMode === 'v3';
      const badgeText = showVersionBadge ? (isV3 ? 'v3' : '! v2') : '';
      const badgeTitle = isV3
        ? 'JSON Patch (v3) processor.'
        : 'Legacy v2 processor. We recommend moving to v3.';
      return (
        <div
          key={node.id}
          className={`${node.kind === 'if' ? 'flow-node flow-node-if' : 'flow-node'}${
            nodeErrorsMap?.[node.id]?.length ? ' flow-node-error' : ''
          }${isFocused ? ' flow-node-focused' : ''}`}
          draggable
          onDragStart={(event) => {
            const payload = JSON.stringify({
              source: 'flow',
              nodeId: node.id,
            });
            event.dataTransfer.setData('application/json', payload);
            event.dataTransfer.setData('text/plain', payload);
          }}
        >
          <div className="flow-node-header">
            <div className="flow-node-title">
              {getFlowNodeLabel(node)}
              {showVersionBadge && (
                <span
                  className={`flow-node-version-badge${
                    isV3 ? ' flow-node-version-badge-v3' : ' flow-node-version-badge-v2'
                  }`}
                  title={badgeTitle}
                >
                  {badgeText}
                </span>
              )}
            </div>
            <div className="flow-node-actions">
              {isFocused && <span className="flow-node-focus-badge">Focused</span>}
              {nodeErrorsMap?.[node.id]?.length ? (
                <span className="flow-node-error-badge" title={nodeErrorsMap[node.id].join(' ')}>
                  {nodeErrorsMap[node.id].length}
                </span>
              ) : null}
              <button
                type="button"
                className="flow-node-edit"
                onClick={() => onOpenEditor(node.id, scope, lane, nodes, setNodes)}
              >
                Edit
              </button>
              <button
                type="button"
                className="flow-node-remove"
                onClick={() => setNodes((prev) => removeNodeById(prev, node.id).nodes)}
              >
                Remove
              </button>
            </div>
          </div>
          {node.kind === 'if' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Then</div>
                <FlowCanvas
                  nodes={node.then}
                  path={{ kind: 'if', id: node.id, branch: 'then' }}
                  setNodes={setNodes}
                  scope={scope}
                  lane={lane}
                  nodeErrorsMap={nodeErrorsMap}
                  versionInfo={versionInfo}
                  focusTarget={focusTarget}
                  getFlowNodeLabel={getFlowNodeLabel}
                  nodeMatchesFocusTarget={nodeMatchesFocusTarget}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onOpenEditor={onOpenEditor}
                />
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Else</div>
                <FlowCanvas
                  nodes={node.else}
                  path={{ kind: 'if', id: node.id, branch: 'else' }}
                  setNodes={setNodes}
                  scope={scope}
                  lane={lane}
                  nodeErrorsMap={nodeErrorsMap}
                  versionInfo={versionInfo}
                  focusTarget={focusTarget}
                  getFlowNodeLabel={getFlowNodeLabel}
                  nodeMatchesFocusTarget={nodeMatchesFocusTarget}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onOpenEditor={onOpenEditor}
                />
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'foreach' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Per-item processors</div>
                <FlowCanvas
                  nodes={Array.isArray(node.config?.processors) ? node.config.processors : []}
                  path={{ kind: 'foreach', id: node.id, branch: 'processors' }}
                  setNodes={setNodes}
                  scope={scope}
                  lane={lane}
                  nodeErrorsMap={nodeErrorsMap}
                  versionInfo={versionInfo}
                  focusTarget={focusTarget}
                  getFlowNodeLabel={getFlowNodeLabel}
                  nodeMatchesFocusTarget={nodeMatchesFocusTarget}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onOpenEditor={onOpenEditor}
                />
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'switch' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Cases</div>
                {(Array.isArray(node.config?.cases) ? node.config.cases : []).map((item) => {
                  const caseId =
                    typeof (item as Record<string, unknown>)?.id === 'string'
                      ? ((item as Record<string, unknown>).id as string)
                      : '';
                  const processors =
                    Array.isArray((item as Record<string, unknown>)?.processors)
                      ? ((item as Record<string, unknown>).processors as FlowNode[])
                      : [];
                  if (!caseId) {
                    return null;
                  }
                  return (
                    <div key={caseId} className="flow-branch flow-branch-nested">
                      <div className="flow-branch-title">Case</div>
                      <FlowCanvas
                        nodes={processors}
                        path={{ kind: 'switch', id: node.id, branch: 'case', caseId }}
                        setNodes={setNodes}
                        scope={scope}
                        lane={lane}
                        nodeErrorsMap={nodeErrorsMap}
                        versionInfo={versionInfo}
                        focusTarget={focusTarget}
                        getFlowNodeLabel={getFlowNodeLabel}
                        nodeMatchesFocusTarget={nodeMatchesFocusTarget}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onOpenEditor={onOpenEditor}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Default</div>
                <FlowCanvas
                  nodes={
                    Array.isArray(node.config?.defaultProcessors) ? node.config.defaultProcessors : []
                  }
                  path={{ kind: 'switch', id: node.id, branch: 'default' }}
                  setNodes={setNodes}
                  scope={scope}
                  lane={lane}
                  nodeErrorsMap={nodeErrorsMap}
                  versionInfo={versionInfo}
                  focusTarget={focusTarget}
                  getFlowNodeLabel={getFlowNodeLabel}
                  nodeMatchesFocusTarget={nodeMatchesFocusTarget}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onOpenEditor={onOpenEditor}
                />
              </div>
            </div>
          )}
        </div>
      );
    })}
    <div className="flow-drop-gap" aria-hidden="true" />
  </div>
);

export default FlowCanvas;
