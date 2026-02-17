export type FlowNodeBase = {
  id: string;
  kind: 'processor' | 'if';
};

export type FlowSwitchCase = {
  id: string;
  match?: string;
  operator?: string;
  processors?: FlowNode[];
  [key: string]: unknown;
};

export type FlowProcessorNode = FlowNodeBase & {
  kind: 'processor';
  processorType: string;
  config?: Record<string, unknown>;
};

export type FlowIfNode = FlowNodeBase & {
  kind: 'if';
  then: FlowNode[];
  else: FlowNode[];
  condition: {
    property: string;
    operator: string;
    value: string;
  };
};

export type FlowNode = FlowProcessorNode | FlowIfNode;

export type FlowBranchPath =
  | { kind: 'root' }
  | { kind: 'if'; id: string; branch: 'then' | 'else' }
  | { kind: 'foreach'; id: string; branch: 'processors' }
  | { kind: 'switch'; id: string; branch: 'case' | 'default'; caseId?: string };

const asFlowNodeArray = (value: unknown): FlowNode[] =>
  Array.isArray(value) ? (value as FlowNode[]) : [];

const asSwitchCaseArray = (value: unknown): FlowSwitchCase[] =>
  Array.isArray(value) ? (value as FlowSwitchCase[]) : [];

export const updateBranchInFlow = (
  nodes: FlowNode[],
  path: FlowBranchPath,
  updater: (items: FlowNode[]) => FlowNode[],
): FlowNode[] => {
  if (path.kind === 'root') {
    return updater(nodes);
  }
  return nodes.map((node) => {
    if (node.kind === 'if') {
      if (node.id === path.id) {
        const branchItems = path.branch === 'then' ? node.then : node.else;
        const updatedBranch = updater(branchItems);
        return {
          ...node,
          [path.branch]: updatedBranch,
        } as FlowIfNode;
      }
      return {
        ...node,
        then: updateBranchInFlow(node.then, path, updater),
        else: updateBranchInFlow(node.else, path, updater),
      } as FlowIfNode;
    }
    if (node.kind === 'processor' && node.processorType === 'foreach') {
      const processors = asFlowNodeArray(node.config?.processors);
      if (node.id === path.id) {
        const updatedBranch = updater(processors);
        return {
          ...node,
          config: {
            ...(node.config || {}),
            processors: updatedBranch,
          },
        } as FlowProcessorNode;
      }
      return {
        ...node,
        config: {
          ...(node.config || {}),
          processors: updateBranchInFlow(processors, path, updater),
        },
      } as FlowProcessorNode;
    }
    if (node.kind === 'processor' && node.processorType === 'switch') {
      const cases = asSwitchCaseArray(node.config?.cases);
      const defaultProcessors = asFlowNodeArray(node.config?.defaultProcessors);
      if (node.id === path.id) {
        if (path.branch === 'default') {
          const updatedBranch = updater(defaultProcessors);
          return {
            ...node,
            config: {
              ...(node.config || {}),
              defaultProcessors: updatedBranch,
            },
          } as FlowProcessorNode;
        }
        if (path.branch === 'case' && path.caseId) {
          const updatedCases = cases.map((item) =>
            item.id === path.caseId
              ? {
                  ...item,
                  processors: updater(asFlowNodeArray(item.processors)),
                }
              : {
                  ...item,
                  processors: updateBranchInFlow(asFlowNodeArray(item.processors), path, updater),
                },
          );
          return {
            ...node,
            config: {
              ...(node.config || {}),
              cases: updatedCases,
            },
          } as FlowProcessorNode;
        }
      }
      const updatedCases = cases.map((item) => ({
        ...item,
        processors: updateBranchInFlow(asFlowNodeArray(item.processors), path, updater),
      }));
      return {
        ...node,
        config: {
          ...(node.config || {}),
          cases: updatedCases,
          defaultProcessors: updateBranchInFlow(defaultProcessors, path, updater),
        },
      } as FlowProcessorNode;
    }
    return node;
  });
};

export const appendNodeAtPath = (
  nodes: FlowNode[],
  path: FlowBranchPath,
  node: FlowNode,
): FlowNode[] => updateBranchInFlow(nodes, path, (items) => [...items, node]);

export const removeNodeById = (
  nodes: FlowNode[],
  nodeId: string,
): { nodes: FlowNode[]; removed: FlowNode | null } => {
  let removed: FlowNode | null = null;
  const updated = nodes.reduce<FlowNode[]>((acc, node) => {
    if (node.id === nodeId) {
      removed = node;
      return acc;
    }
    if (node.kind === 'if') {
      const thenResult = removeNodeById(node.then, nodeId);
      const elseResult = removeNodeById(node.else, nodeId);
      if (thenResult.removed) {
        removed = thenResult.removed;
      }
      if (elseResult.removed) {
        removed = elseResult.removed;
      }
      acc.push({
        ...node,
        then: thenResult.nodes,
        else: elseResult.nodes,
      });
      return acc;
    }
    if (node.kind === 'processor' && node.processorType === 'foreach') {
      const nested = asFlowNodeArray(node.config?.processors);
      const nestedResult = removeNodeById(nested, nodeId);
      if (nestedResult.removed) {
        removed = nestedResult.removed;
      }
      acc.push({
        ...node,
        config: {
          ...(node.config || {}),
          processors: nestedResult.nodes,
        },
      } as FlowProcessorNode);
      return acc;
    }
    if (node.kind === 'processor' && node.processorType === 'switch') {
      const cases = asSwitchCaseArray(node.config?.cases);
      const updatedCases = cases.map((item) => {
        const result = removeNodeById(asFlowNodeArray(item.processors), nodeId);
        if (result.removed) {
          removed = result.removed;
        }
        return {
          ...item,
          processors: result.nodes,
        };
      });
      const defaults = asFlowNodeArray(node.config?.defaultProcessors);
      const defaultResult = removeNodeById(defaults, nodeId);
      if (defaultResult.removed) {
        removed = defaultResult.removed;
      }
      acc.push({
        ...node,
        config: {
          ...(node.config || {}),
          cases: updatedCases,
          defaultProcessors: defaultResult.nodes,
        },
      } as FlowProcessorNode);
      return acc;
    }
    acc.push(node);
    return acc;
  }, []);
  return { nodes: updated, removed };
};

export const findNodeById = (nodes: FlowNode[], nodeId: string): FlowNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.kind === 'if') {
      const foundThen = findNodeById(node.then, nodeId);
      if (foundThen) {
        return foundThen;
      }
      const foundElse = findNodeById(node.else, nodeId);
      if (foundElse) {
        return foundElse;
      }
    }
    if (node.kind === 'processor' && node.processorType === 'foreach') {
      const nested = asFlowNodeArray(node.config?.processors);
      const foundNested = findNodeById(nested, nodeId);
      if (foundNested) {
        return foundNested;
      }
    }
    if (node.kind === 'processor' && node.processorType === 'switch') {
      const cases = asSwitchCaseArray(node.config?.cases);
      for (const item of cases) {
        const foundCase = findNodeById(asFlowNodeArray(item.processors), nodeId);
        if (foundCase) {
          return foundCase;
        }
      }
      const defaults = asFlowNodeArray(node.config?.defaultProcessors);
      const foundDefault = findNodeById(defaults, nodeId);
      if (foundDefault) {
        return foundDefault;
      }
    }
  }
  return null;
};

export const replaceNodeById = (
  nodes: FlowNode[],
  nodeId: string,
  nextNode: FlowNode,
): FlowNode[] =>
  nodes.map((node) => {
    if (node.id === nodeId) {
      return nextNode;
    }
    if (node.kind === 'if') {
      return {
        ...node,
        then: replaceNodeById(node.then, nodeId, nextNode),
        else: replaceNodeById(node.else, nodeId, nextNode),
      } as FlowIfNode;
    }
    if (node.kind === 'processor' && node.processorType === 'foreach') {
      const nested = asFlowNodeArray(node.config?.processors);
      return {
        ...node,
        config: {
          ...(node.config || {}),
          processors: replaceNodeById(nested, nodeId, nextNode),
        },
      } as FlowProcessorNode;
    }
    if (node.kind === 'processor' && node.processorType === 'switch') {
      const cases = asSwitchCaseArray(node.config?.cases);
      const updatedCases = cases.map((item) => ({
        ...item,
        processors: replaceNodeById(asFlowNodeArray(item.processors), nodeId, nextNode),
      }));
      const defaults = asFlowNodeArray(node.config?.defaultProcessors);
      return {
        ...node,
        config: {
          ...(node.config || {}),
          cases: updatedCases,
          defaultProcessors: replaceNodeById(defaults, nodeId, nextNode),
        },
      } as FlowProcessorNode;
    }
    return node;
  });
