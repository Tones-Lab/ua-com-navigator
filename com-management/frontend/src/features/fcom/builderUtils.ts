export type ConditionNode = {
  id: string;
  type: 'condition';
  left: string;
  operator: string;
  right: string;
};

export type ConditionGroup = {
  id: string;
  type: 'group';
  operator: 'AND' | 'OR';
  children: Array<ConditionTree>;
};

export type ConditionTree = ConditionNode | ConditionGroup;

export type BuilderConditionRow = {
  id: string;
  condition: ConditionTree;
  result: string;
};

export const createConditionNode = (nextId: () => string): ConditionNode => ({
  id: nextId(),
  type: 'condition',
  left: '$v1',
  operator: '==',
  right: '1',
});

export const createGroupNode = (nextId: () => string): ConditionGroup => ({
  id: nextId(),
  type: 'group',
  operator: 'AND',
  children: [createConditionNode(nextId)],
});

export const updateConditionNode = (
  node: ConditionTree,
  targetId: string,
  updater: (current: ConditionTree) => ConditionTree,
): ConditionTree => {
  if (node.id === targetId) {
    return updater(node);
  }
  if (node.type === 'group') {
    return {
      ...node,
      children: node.children.map((child) => updateConditionNode(child, targetId, updater)),
    };
  }
  return node;
};

export const buildConditionExpression = (node: ConditionTree): string => {
  if (node.type === 'condition') {
    const left = node.left.trim();
    const right = node.right.trim();
    if (!left || !node.operator || !right) {
      return '';
    }
    return `${left} ${node.operator} ${right}`;
  }
  const parts = node.children.map((child) => buildConditionExpression(child)).filter(Boolean);
  if (parts.length !== node.children.length) {
    return '';
  }
  const joiner = node.operator === 'AND' ? ' && ' : ' || ';
  return `(${parts.join(joiner)})`;
};

export const buildFriendlyEval = (
  rows: BuilderConditionRow[],
  elseResult: string,
): string => {
  if (rows.length === 0) {
    return '';
  }
  const elseValue = elseResult.trim();
  if (!elseValue) {
    return '';
  }
  let expr = elseValue;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const result = row.result.trim();
    const condition = buildConditionExpression(row.condition);
    if (!condition || !result) {
      return '';
    }
    expr = `(${condition}) ? ${result} : ${expr}`;
  }
  return expr;
};
