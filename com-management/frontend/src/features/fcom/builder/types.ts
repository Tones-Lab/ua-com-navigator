import type { Dispatch, ReactNode, SetStateAction } from 'react';

export type BuilderType = 'literal' | 'eval' | 'processor';
export type BuilderFocus = BuilderType | null;
export type BuilderMode = 'friendly' | 'regular';
export type ProcessorStep = 'select' | 'configure' | 'review';

export type BuilderTarget = { panelKey: string; field: string } | null;

export type BuilderOverrideVersion = {
  mode: 'none' | 'v2' | 'v3' | 'mixed';
  label: string;
  detail: string;
} | null;

export type BuilderSwitchModalState = {
  open: boolean;
  from?: BuilderType | null;
  to?: BuilderType | null;
};

export type BuilderCondition = { id: string; condition: any; result: string };

export type OpenAdvancedFlowModal = (
  scope: 'object' | 'global',
  objectName?: string | null,
  field?: string | null,
) => void;

export type RenderConditionNode = (
  rowId: string,
  condition: any,
  depth: number,
  isNested: boolean,
  groupCount: number,
) => ReactNode;

export type RenderProcessorConfigFields = (
  processorType: string,
  config: Record<string, any>,
  onChange: (key: string, value: string | boolean) => void,
  context: 'flow' | 'builder',
  fieldErrors?: Record<string, string[]>,
) => ReactNode;

export type RenderFlowList = (
  nodes: any[],
  path: any,
  setNodes: Dispatch<SetStateAction<any[]>>,
  scope: 'object' | 'global',
  lane: 'object' | 'pre' | 'post',
  nodeErrorsMap?: Record<string, string[]>,
) => ReactNode;
