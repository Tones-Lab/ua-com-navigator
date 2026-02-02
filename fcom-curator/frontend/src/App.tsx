import React, { useEffect, useMemo, useRef, useState } from 'react';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { useSessionStore } from './stores';
import api from './services/api';
import './App.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="panel">
            <h2>Something went wrong</h2>
            <p className="error">{this.state.error?.message || 'Unknown error'}</p>
            <button type="button" className="save-button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { session, isAuthenticated, setSession, setServers, servers, clearSession } = useSessionStore();
  const [serverId, setServerId] = useState<string>('');
  const [authType, setAuthType] = useState<'basic' | 'certificate'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [certPath, setCertPath] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [caPath, setCaPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browsePath, setBrowsePath] = useState('/');
  const [showPathModal, setShowPathModal] = useState(false);
  const formatDisplayPath = (rawPath: string) => {
    const cleaned = rawPath.replace(/^\/+/, '');
    if (!cleaned) {
      return '/';
    }
    const parts = cleaned.split('/');
    if (parts[0]?.startsWith('id-')) {
      parts[0] = parts[0].replace(/^id-/, '');
    }
    return `/${parts.join('/')}`;
  };

  const getCurrentPath = () => {
    if (selectedFile?.PathID) {
      return formatDisplayPath(selectedFile.PathID);
    }
    if (browseNode) {
      return formatDisplayPath(browseNode);
    }
    return '/';
  };
  const renderOverrideSummaryCard = (
    obj: any,
    overrideValueMap: Map<string, any>,
    fields: string[],
    title: string,
  ) => {
    const maxItems = 6;
    const visible = fields.slice(0, maxItems);
    const remaining = fields.length - visible.length;
    return (
      <div className="override-summary-card" role="tooltip">
        <div className="override-summary-title">
          {title}
        </div>
        <ul className="override-summary-list">
          {visible.map((field) => (
            <li key={field} className="override-summary-item">
              <span className="override-summary-field">{formatEventFieldLabel(field)}</span>
              <span className="override-summary-value">
                {renderValue(
                  overrideValueMap.get(`$.event.${field}`),
                  obj?.trap?.variables,
                )}
              </span>
            </li>
          ))}
          {remaining > 0 && (
            <li className="override-summary-item">
              <span className="override-summary-value">+{remaining} more</span>
            </li>
          )}
        </ul>
      </div>
    );
  };
  const [browseLoading, setBrowseLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'content'>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<any>(null);
  const [searchRebuildPending, setSearchRebuildPending] = useState(false);
  const searchRebuildStartRef = useRef<number | null>(null);
  const searchStatusPollRef = useRef<number | null>(null);
  const [searchHighlightActive, setSearchHighlightActive] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [highlightPathId, setHighlightPathId] = useState<string | null>(null);
  const [highlightObjectKeys, setHighlightObjectKeys] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const highlightNextOpenRef = useRef(false);
  const objectRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getRawPath = () => {
    if (selectedFile?.PathID) {
      return `/${selectedFile.PathID}`;
    }
    if (browseNode) {
      return `/${browseNode}`;
    }
    return '/';
  };

  const getParentLabel = (node?: string) => {
    if (!node) {
      return '';
    }
    const cleaned = node.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length === 0) {
      return '';
    }
    const last = parts[parts.length - 1];
    return last.startsWith('id-') ? last.replace(/^id-/, '') : last;
  };

  const getParentPath = (node?: string) => {
    if (!node) {
      return '';
    }
    const cleaned = node.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length <= 1) {
      return '';
    }
    return parts.slice(0, -1).join('/');
  };

  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<any>(null);
  const [browseNode, setBrowseNode] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Array<{ type: 'file' | 'folder'; pathId: string; label: string; node?: string }>>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [folderOverview, setFolderOverview] = useState<any>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; node: string | null }>>([
    { label: '/', node: null },
  ]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'friendly' | 'preview'>('preview');
  const [originalText, setOriginalText] = useState('');
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [saveElapsed, setSaveElapsed] = useState(0);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [panelEditState, setPanelEditState] = useState<Record<string, boolean>>({});
  const [panelDrafts, setPanelDrafts] = useState<Record<string, any>>({});
  const [panelEvalModes, setPanelEvalModes] = useState<Record<string, Record<string, boolean>>>({});
  const [overrideInfo, setOverrideInfo] = useState<any | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pendingOverrideSave, setPendingOverrideSave] = useState<any[] | null>(null);
  const [removeOverrideModal, setRemoveOverrideModal] = useState<{
    open: boolean;
    objectName?: string;
    field?: string;
    baseValue?: string;
    panelKey?: string;
  }>({ open: false });
  const [panelOverrideRemovals, setPanelOverrideRemovals] = useState<Record<string, string[]>>({});
  const [panelNavWarning, setPanelNavWarning] = useState<{
    open: boolean;
    fields: Record<string, string[]>;
  }>({ open: false, fields: {} });
  const [removeAllOverridesModal, setRemoveAllOverridesModal] = useState<{
    open: boolean;
    panelKey?: string;
    fields?: string[];
    baseValues?: Record<string, string>;
  }>({ open: false });
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [eventsSchemaFields, setEventsSchemaFields] = useState<string[]>([]);
  const [eventsSchemaLoading, setEventsSchemaLoading] = useState(false);
  const [eventsSchemaError, setEventsSchemaError] = useState<string | null>(null);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [addFieldSearch, setAddFieldSearch] = useState('');
  const [addFieldContext, setAddFieldContext] = useState<{ panelKey: string; obj: any } | null>(null);
  const [panelAddedFields, setPanelAddedFields] = useState<Record<string, string[]>>({});
  const urlHydrated = useRef(false);
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varModalToken, setVarModalToken] = useState<string | null>(null);
  const [varModalVars, setVarModalVars] = useState<any[]>([]);
  const [varModalMode, setVarModalMode] = useState<'view' | 'insert'>('view');
  const [varInsertContext, setVarInsertContext] = useState<{
    panelKey: string;
    field: string;
    value: string;
    replaceStart: number;
    replaceEnd: number;
  } | null>(null);
  const [builderOpen, setBuilderOpen] = useState(true);
  const [builderTarget, setBuilderTarget] = useState<{ panelKey: string; field: string } | null>(null);
  const [builderFocus, setBuilderFocus] = useState<'eval' | 'processor' | 'literal' | null>(null);
  const [builderTypeLocked, setBuilderTypeLocked] = useState<'eval' | 'processor' | 'literal' | null>(null);
  const [builderMode, setBuilderMode] = useState<'friendly' | 'regular'>('friendly');
  const [showBuilderHelpModal, setShowBuilderHelpModal] = useState(false);
  const [processorStep, setProcessorStep] = useState<'select' | 'configure' | 'review'>('select');
  const [processorType, setProcessorType] = useState<string | null>(null);
  const [showProcessorJson, setShowProcessorJson] = useState(true);
  const [showAdvancedProcessorModal, setShowAdvancedProcessorModal] = useState(false);
  const [advancedProcessorSearch, setAdvancedProcessorSearch] = useState('');
  const [advancedProcessorScope, setAdvancedProcessorScope] = useState<'object' | 'global'>('object');
  const [processorTooltip, setProcessorTooltip] = useState<{
    title: string;
    description: string;
    example: string;
    x: number;
    y: number;
  } | null>(null);
  const [builderLiteralText, setBuilderLiteralText] = useState('');
  const [builderSwitchModal, setBuilderSwitchModal] = useState<{
    open: boolean;
    from?: 'eval' | 'processor' | 'literal' | null;
    to?: 'eval' | 'processor' | 'literal' | null;
  }>({ open: false });
  type ConditionNode = {
    id: string;
    type: 'condition';
    left: string;
    operator: string;
    right: string;
  };
  type ConditionGroup = {
    id: string;
    type: 'group';
    operator: 'AND' | 'OR';
    children: Array<ConditionTree>;
  };
  type ConditionTree = ConditionNode | ConditionGroup;
  type BuilderConditionRow = {
    id: string;
    condition: ConditionTree;
    result: string;
  };
  type FlowNodeBase = {
    id: string;
    kind: 'processor' | 'if';
  };
  type FlowProcessorNode = FlowNodeBase & {
    kind: 'processor';
    processorType: string;
    config?: Record<string, any>;
  };
  type FlowIfNode = FlowNodeBase & {
    kind: 'if';
    then: FlowNode[];
    else: FlowNode[];
    condition: {
      property: string;
      operator: string;
      value: string;
    };
  };
  type FlowNode = FlowProcessorNode | FlowIfNode;
  type FlowBranchPath =
    | { kind: 'root' }
    | { kind: 'if'; id: string; branch: 'then' | 'else' }
    | { kind: 'foreach'; id: string; branch: 'processors' }
    | { kind: 'switch'; id: string; branch: 'case' | 'default'; caseId?: string };
  const [processorDraft, setProcessorDraft] = useState({
    sourceType: 'literal' as 'literal' | 'path',
    source: '',
    pattern: '',
    targetField: '',
  });
  const builderIdRef = useRef(0);
  const switchCaseIdRef = useRef(0);
  const nextBuilderId = () => {
    builderIdRef.current += 1;
    return `cond-${builderIdRef.current}`;
  };
  const nextFlowId = () => {
    flowIdRef.current += 1;
    return `flow-${flowIdRef.current}`;
  };
  const nextSwitchCaseId = () => {
    switchCaseIdRef.current += 1;
    return `case-${switchCaseIdRef.current}`;
  };
  const createFlowNode = (payload: { nodeKind: 'processor' | 'if'; processorType?: string }): FlowNode => {
    if (payload.nodeKind === 'if') {
      return {
        id: nextFlowId(),
        kind: 'if',
        then: [],
        else: [],
        condition: {
          property: '$.event.Summary',
          operator: '=~',
          value: 'pattern',
        },
      };
    }
    if (payload.processorType === 'set') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'set',
        config: {
          sourceType: 'literal',
          source: '',
          targetField: '$.event.Field',
        },
      };
    }
    if (payload.processorType === 'regex') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'regex',
        config: {
          source: '$.event.Summary',
          pattern: '',
          targetField: '$.event.Field',
        },
      };
    }
    if (payload.processorType === 'append') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'append',
        config: {
          source: 'Example Value',
          arrayText: '[]',
          targetField: '$.event.NewArray',
        },
      };
    }
    if (payload.processorType === 'appendToOutputStream') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'appendToOutputStream',
        config: {
          source: '$.trap',
          output: 'pulsar+ssl:///assure1/event/sink',
        },
      };
    }
    if (payload.processorType === 'break') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'break',
        config: {},
      };
    }
    if (payload.processorType === 'convert') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'convert',
        config: {
          source: '$.event.Count',
          type: 'inttostring',
          targetField: '$.event.CountString',
        },
      };
    }
    if (payload.processorType === 'copy') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'copy',
        config: {
          source: '$.event.Count',
          targetField: '$.event.CopiedCount',
        },
      };
    }
    if (payload.processorType === 'discard') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'discard',
        config: {},
      };
    }
    if (payload.processorType === 'eval') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'eval',
        config: {
          source: '$.event.Count',
          targetField: '$.localmem.evalResult',
        },
      };
    }
    if (payload.processorType === 'foreach') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'foreach',
        config: {
          source: '$.event.Details.trap.variables',
          keyVal: 'i',
          valField: 'v',
          processors: [],
        },
      };
    }
    if (payload.processorType === 'grok') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'grok',
        config: {
          source: '$.syslog.datagram',
          pattern: '%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}',
          targetField: '$.syslog.variables',
        },
      };
    }
    if (payload.processorType === 'json') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'json',
        config: {
          source: '{"key":"value"}',
          targetField: '$.localmem.json',
        },
      };
    }
    if (payload.processorType === 'log') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'log',
        config: {
          type: 'info',
          source: 'Log message',
        },
      };
    }
    if (payload.processorType === 'lookup') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'lookup',
        config: {
          source: 'db',
          propertiesText: '{}',
          fallbackText: '{}',
          targetField: '$.localmem.results',
        },
      };
    }
    if (payload.processorType === 'math') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'math',
        config: {
          source: '$.event.Count',
          operation: '*',
          value: '2',
          targetField: '$.localmem.CountTimesTwo',
        },
      };
    }
    if (payload.processorType === 'remove') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'remove',
        config: {
          source: '$.trap.timeTicks',
        },
      };
    }
    if (payload.processorType === 'rename') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'rename',
        config: {
          source: '$.event.Details',
          targetField: '$.event.DetailsOld',
        },
      };
    }
    if (payload.processorType === 'replace') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'replace',
        config: {
          source: 'This is a test',
          pattern: 'a test',
          replacement: 'not a test',
          targetField: '$.localmem.example',
          regex: false,
        },
      };
    }
    if (payload.processorType === 'setOutputStream') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'setOutputStream',
        config: {
          output: 'pulsar+ssl:///assure1/event/sink',
        },
      };
    }
    if (payload.processorType === 'sort') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'sort',
        config: {
          source: '$.trap.variables[0]',
          targetField: '$.trap.sortedVariables',
        },
      };
    }
    if (payload.processorType === 'split') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'split',
        config: {
          source: '1,2,3,4',
          delimiter: ',',
          targetField: '$.localmem.splitarr',
        },
      };
    }
    if (payload.processorType === 'strcase') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'strcase',
        config: {
          source: 'HELLO, WORLD',
          type: 'lower',
          targetField: '$.localmem.lowercase',
        },
      };
    }
    if (payload.processorType === 'substr') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'substr',
        config: {
          source: 'Hello',
          start: '1',
          end: '',
          targetField: '$.localmem.substr',
        },
      };
    }
    if (payload.processorType === 'switch') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'switch',
        config: {
          source: '$.localmem.val1',
          operator: '!=',
          cases: [
            {
              id: nextSwitchCaseId(),
              match: '2',
              operator: '!=',
              processors: [],
            },
          ],
          defaultProcessors: [],
        },
      };
    }
    if (payload.processorType === 'trim') {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: 'trim',
        config: {
          source: 'Hello',
          cutset: 'H',
          targetField: '$.localmem.trim',
        },
      };
    }
    return {
      id: nextFlowId(),
      kind: 'processor',
      processorType: payload.processorType || 'set',
      config: {},
    };
  };
  const updateBranchInFlow = (
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
        const processors = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
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
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const defaultProcessors = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
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
            const updatedCases = cases.map((item: any) => (
              item.id === path.caseId
                ? { ...item, processors: updater(Array.isArray(item.processors) ? item.processors : []) }
                : {
                  ...item,
                  processors: updateBranchInFlow(
                    Array.isArray(item.processors) ? item.processors : [],
                    path,
                    updater,
                  ),
                }
            ));
            return {
              ...node,
              config: {
                ...(node.config || {}),
                cases: updatedCases,
              },
            } as FlowProcessorNode;
          }
        }
        const updatedCases = cases.map((item: any) => ({
          ...item,
          processors: updateBranchInFlow(
            Array.isArray(item.processors) ? item.processors : [],
            path,
            updater,
          ),
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
  const appendNodeAtPath = (nodes: FlowNode[], path: FlowBranchPath, node: FlowNode): FlowNode[] => (
    updateBranchInFlow(nodes, path, (items) => [...items, node])
  );
  const removeNodeById = (nodes: FlowNode[], nodeId: string): { nodes: FlowNode[]; removed: FlowNode | null } => {
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
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
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
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const updatedCases = cases.map((item: any) => {
          const result = removeNodeById(Array.isArray(item.processors) ? item.processors : [], nodeId);
          if (result.removed) {
            removed = result.removed;
          }
          return {
            ...item,
            processors: result.nodes,
          };
        });
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
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
  const findNodeById = (nodes: FlowNode[], nodeId: string): FlowNode | null => {
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
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        const foundNested = findNodeById(nested, nodeId);
        if (foundNested) {
          return foundNested;
        }
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        for (const item of cases) {
          const foundCase = findNodeById(Array.isArray(item.processors) ? item.processors : [], nodeId);
          if (foundCase) {
            return foundCase;
          }
        }
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
        const foundDefault = findNodeById(defaults, nodeId);
        if (foundDefault) {
          return foundDefault;
        }
      }
    }
    return null;
  };
  const replaceNodeById = (nodes: FlowNode[], nodeId: string, nextNode: FlowNode): FlowNode[] => (
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
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        return {
          ...node,
          config: {
            ...(node.config || {}),
            processors: replaceNodeById(nested, nodeId, nextNode),
          },
        } as FlowProcessorNode;
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const updatedCases = cases.map((item: any) => ({
          ...item,
          processors: replaceNodeById(
            Array.isArray(item.processors) ? item.processors : [],
            nodeId,
            nextNode,
          ),
        }));
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
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
    })
  );
  const getFlowStateByLane = (scope: 'object' | 'global', lane: 'object' | 'pre' | 'post') => {
    if (scope === 'global') {
      if (lane === 'pre') {
        return { nodes: globalPreFlow, setNodes: setGlobalPreFlow };
      }
      return { nodes: globalPostFlow, setNodes: setGlobalPostFlow };
    }
    return { nodes: advancedFlow, setNodes: setAdvancedFlow };
  };
  const openFlowEditor = (
    nodeId: string,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
    nodesOverride?: FlowNode[],
    setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>,
  ) => {
    const nodes = nodesOverride || getFlowStateByLane(scope, lane).nodes;
    const node = findNodeById(nodes, nodeId);
    if (!node) {
      return;
    }
    setFlowEditor({ scope, lane, nodeId, setNodesOverride });
    setFlowEditorDraft(JSON.parse(JSON.stringify(node)) as FlowNode);
  };
  const parseJsonValue = <T,>(value: string | undefined, fallback: T): T => {
    if (!value || !value.trim()) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  const buildFlowProcessor = (node: FlowNode): any => {
    if (node.kind === 'if') {
      return {
        if: {
          source: node.condition.property,
          operator: node.condition.operator,
          value: node.condition.value,
          processors: buildFlowProcessors(node.then),
          else: buildFlowProcessors(node.else),
        },
      };
    }
    if (node.processorType === 'set') {
      const sourceValue = node.config?.sourceType === 'path'
        ? normalizeSourcePath(String(node.config?.source || ''))
        : node.config?.source;
      let argsValue: any[] | undefined;
      if (typeof node.config?.argsText === 'string' && node.config.argsText.trim()) {
        try {
          const parsed = JSON.parse(node.config.argsText);
          if (Array.isArray(parsed)) {
            argsValue = parsed;
          }
        } catch {
          argsValue = undefined;
        }
      }
      return {
        set: {
          source: sourceValue,
          ...(argsValue ? { args: argsValue } : {}),
          targetField: node.config?.targetField || '',
        },
      };
    }
    if (node.processorType === 'regex') {
      const sourceValue = normalizeSourcePath(String(node.config?.source || ''));
      const groupNumber = Number(node.config?.group);
      const hasGroup = Number.isFinite(groupNumber) && String(node.config?.group).trim() !== '';
      return {
        regex: {
          source: sourceValue,
          pattern: node.config?.pattern || '',
          ...(hasGroup ? { group: groupNumber } : {}),
          targetField: node.config?.targetField || '',
        },
      };
    }
    if (node.processorType === 'append') {
      return {
        append: {
          source: node.config?.source ?? '',
          array: parseJsonValue(node.config?.arrayText, [] as any[]),
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'appendToOutputStream') {
      return {
        appendToOutputStream: {
          source: node.config?.source ?? '',
          output: node.config?.output ?? '',
        },
      };
    }
    if (node.processorType === 'break') {
      return { break: {} };
    }
    if (node.processorType === 'convert') {
      return {
        convert: {
          source: node.config?.source ?? '',
          type: node.config?.type ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'copy') {
      return {
        copy: {
          source: node.config?.source ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'discard') {
      return { discard: {} };
    }
    if (node.processorType === 'eval') {
      return {
        eval: {
          source: node.config?.source ?? '',
          ...(node.config?.targetField ? { targetField: node.config?.targetField } : {}),
        },
      };
    }
    if (node.processorType === 'foreach') {
      const nestedNodes = Array.isArray(node.config?.processors)
        ? node.config.processors
        : [];
      return {
        foreach: {
          source: node.config?.source ?? '',
          ...(node.config?.keyVal ? { keyVal: node.config.keyVal } : {}),
          ...(node.config?.valField ? { valField: node.config.valField } : {}),
          processors: buildFlowProcessors(nestedNodes),
        },
      };
    }
    if (node.processorType === 'grok') {
      return {
        grok: {
          source: node.config?.source ?? '',
          pattern: node.config?.pattern ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'json') {
      return {
        json: {
          source: node.config?.source ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'log') {
      return {
        log: {
          type: node.config?.type ?? '',
          source: node.config?.source ?? '',
        },
      };
    }
    if (node.processorType === 'lookup') {
      return {
        lookup: {
          source: node.config?.source ?? '',
          properties: parseJsonValue(node.config?.propertiesText, {}),
          fallback: parseJsonValue(node.config?.fallbackText, {}),
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'math') {
      return {
        math: {
          source: node.config?.source ?? '',
          operation: node.config?.operation ?? '',
          value: node.config?.value ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'remove') {
      return {
        remove: {
          source: node.config?.source ?? '',
        },
      };
    }
    if (node.processorType === 'rename') {
      return {
        rename: {
          source: node.config?.source ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'replace') {
      return {
        replace: {
          source: node.config?.source ?? '',
          pattern: node.config?.pattern ?? '',
          replacement: node.config?.replacement ?? '',
          ...(typeof node.config?.regex === 'boolean' ? { regex: node.config.regex } : {}),
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'setOutputStream') {
      return {
        setOutputStream: {
          output: node.config?.output ?? '',
        },
      };
    }
    if (node.processorType === 'sort') {
      return {
        sort: {
          source: node.config?.source ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'split') {
      return {
        split: {
          source: node.config?.source ?? '',
          delimiter: node.config?.delimiter ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'strcase') {
      return {
        strcase: {
          source: node.config?.source ?? '',
          type: node.config?.type ?? '',
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'substr') {
      const startValue = node.config?.start ?? '';
      const endValue = node.config?.end ?? '';
      return {
        substr: {
          source: node.config?.source ?? '',
          ...(String(startValue).trim() ? { start: Number(startValue) } : {}),
          ...(String(endValue).trim() ? { end: Number(endValue) } : {}),
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    if (node.processorType === 'switch') {
      const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
      const defaultProcessors = Array.isArray(node.config?.defaultProcessors)
        ? node.config.defaultProcessors
        : [];
      return {
        switch: {
          source: node.config?.source ?? '',
          operator: node.config?.operator ?? '',
          case: cases.map((item: any) => ({
            match: item.match ?? '',
            ...(item.operator ? { operator: item.operator } : {}),
            then: buildFlowProcessors(Array.isArray(item.processors) ? item.processors : []),
          })),
          default: buildFlowProcessors(defaultProcessors),
        },
      };
    }
    if (node.processorType === 'trim') {
      return {
        trim: {
          source: node.config?.source ?? '',
          ...(node.config?.cutset ? { cutset: node.config.cutset } : {}),
          targetField: node.config?.targetField ?? '',
        },
      };
    }
    return {
      [node.processorType]: node.config || {},
    };
  };
  const buildFlowProcessors = (nodes: FlowNode[]) => nodes.map(buildFlowProcessor);
  const createConditionNode = (): ConditionNode => ({
    id: nextBuilderId(),
    type: 'condition',
    left: '$v1',
    operator: '==',
    right: '1',
  });
  const createGroupNode = (): ConditionGroup => ({
    id: nextBuilderId(),
    type: 'group',
    operator: 'AND',
    children: [createConditionNode()],
  });
  const [builderConditions, setBuilderConditions] = useState<BuilderConditionRow[]>([
    { id: nextBuilderId(), condition: createConditionNode(), result: '1' },
  ]);
  const [builderElseResult, setBuilderElseResult] = useState('0');
  const [builderRegularText, setBuilderRegularText] = useState('');
  const varListRef = useRef<HTMLDivElement | null>(null);
  const varRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const builderSyncRef = useRef<'friendly' | 'regular' | null>(null);
  const [advancedFlow, setAdvancedFlow] = useState<FlowNode[]>([]);
  const [globalPreFlow, setGlobalPreFlow] = useState<FlowNode[]>([]);
  const [globalPostFlow, setGlobalPostFlow] = useState<FlowNode[]>([]);
  const [flowEditor, setFlowEditor] = useState<{
    scope: 'object' | 'global';
    lane: 'object' | 'pre' | 'post';
    nodeId: string;
    setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  } | null>(null);
  const [flowEditorDraft, setFlowEditorDraft] = useState<FlowNode | null>(null);
  const [showFieldReferenceModal, setShowFieldReferenceModal] = useState(false);
  const [eventFieldPickerOpen, setEventFieldPickerOpen] = useState(false);
  const [eventFieldSearch, setEventFieldSearch] = useState('');
  const [eventFieldInsertContext, setEventFieldInsertContext] = useState<{
    panelKey: string;
    field: string;
    value: string;
    replaceStart: number;
    replaceEnd: number;
  } | null>(null);
  const flowIdRef = useRef(0);
  const isPreGlobalFlow = flowEditor?.scope === 'global' && flowEditor?.lane === 'pre';
  const isPreScopeEventPath = (value: string | undefined | null) => (
    isPreGlobalFlow && typeof value === 'string' && value.includes('$.event')
  );
  const hasPreScopeEventUsage = (draft: FlowNode | null) => {
    if (!draft || !isPreGlobalFlow) {
      return false;
    }
    if (draft.kind === 'if') {
      return isPreScopeEventPath(draft.condition.property)
        || isPreScopeEventPath(draft.condition.value);
    }
    return isPreScopeEventPath(draft.config?.source)
      || isPreScopeEventPath(draft.config?.targetField)
      || isPreScopeEventPath(draft.config?.pattern);
  };

  const getNestedValue = (source: any, path: string) => (
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source)
  );
  const parsePermissionFlag = (value: any) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', ''].includes(normalized)) {
        return false;
      }
    }
    return false;
  };
  const parseAccessValue = (value: any) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (/(write|update|edit|modify|rw|readwrite)/.test(normalized)) {
        return true;
      }
      if (/(read|ro|view|readonly|read-only)/.test(normalized)) {
        return false;
      }
    }
    return null;
  };
  const findRulePermissionValues = (source: any) => {
    const matches: any[] = [];
    const walk = (node: any, pathKeys: string[]) => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, [...pathKeys, String(index)]));
        return;
      }
      if (typeof node !== 'object') {
        return;
      }
      Object.entries(node).forEach(([key, value]) => {
        const nextPath = [...pathKeys, key];
        const hasRule = nextPath.some((segment) => /rule/i.test(segment));
        const hasRules = nextPath.some((segment) => /rules/i.test(segment));
        if (/update/i.test(key) && hasRule && hasRules) {
          matches.push(value);
        }
        if (/(access|permission|mode)/i.test(key) && hasRule && hasRules) {
          matches.push(value);
        }
        walk(value, nextPath);
      });
    };
    walk(source, []);
    return matches;
  };
  const permissionPaths = [
    'data.Permissions.rule.Rules.update',
    'data.Permissions.rule.Rules.Update',
    'data.Permissions.Rule.Rules.update',
    'data.Permissions.Rule.Rules.Update',
    'Permissions.rule.Rules.update',
    'Permissions.rule.Rules.Update',
    'Permissions.Rule.Rules.update',
    'Permissions.Rule.Rules.Update',
    'data.permissions.rule.Rules.update',
    'permissions.rule.Rules.update',
  ];

  const flowProcessorConfigSpecs: Record<string, Array<{
    key: string;
    label: string;
    type: 'text' | 'json' | 'boolean';
    placeholder?: string;
  }>> = {
    append: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Example Value' },
      { key: 'array', label: 'Array (JSON)', type: 'json', placeholder: '[]' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.NewArray' },
    ],
    appendToOutputStream: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap' },
      { key: 'output', label: 'Output', type: 'text', placeholder: 'pulsar+ssl:///assure1/event/sink' },
    ],
    break: [],
    convert: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'type', label: 'Type', type: 'text', placeholder: 'inttostring' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CountString' },
    ],
    copy: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CopiedCount' },
    ],
    discard: [],
    eval: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '<expression>' },
      { key: 'targetField', label: 'Target (optional)', type: 'text', placeholder: '$.localmem.evalResult' },
    ],
    foreach: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Details.trap.variables' },
      { key: 'keyVal', label: 'Key', type: 'text', placeholder: 'i' },
      { key: 'valField', label: 'Value', type: 'text', placeholder: 'v' },
    ],
    grok: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.syslog.datagram' },
      { key: 'pattern', label: 'Pattern', type: 'text', placeholder: '%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.syslog.variables' },
    ],
    json: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '{"key":"value"}' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.json' },
    ],
    log: [
      { key: 'type', label: 'Type', type: 'text', placeholder: 'info' },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Log message' },
    ],
    lookup: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'db' },
      { key: 'properties', label: 'Properties (JSON)', type: 'json', placeholder: '{}' },
      { key: 'fallback', label: 'Fallback (JSON)', type: 'json', placeholder: '{}' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.results' },
    ],
    math: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'operation', label: 'Operation', type: 'text', placeholder: '*' },
      { key: 'value', label: 'Value', type: 'text', placeholder: '2' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.CountTimesTwo' },
    ],
    remove: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.timeTicks' },
    ],
    rename: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Details' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.DetailsOld' },
    ],
    replace: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'This is a test' },
      { key: 'pattern', label: 'Pattern', type: 'text', placeholder: 'a test' },
      { key: 'replacement', label: 'Replacement', type: 'text', placeholder: 'not a test' },
      { key: 'regex', label: 'Regex', type: 'boolean' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.example' },
    ],
    setOutputStream: [
      { key: 'output', label: 'Output', type: 'text', placeholder: 'pulsar+ssl:///assure1/event/sink' },
    ],
    sort: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.variables[0]' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.trap.sortedVariables' },
    ],
    split: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '1,2,3,4' },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.splitarr' },
    ],
    strcase: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'HELLO, WORLD' },
      { key: 'type', label: 'Type', type: 'text', placeholder: 'lower' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.lowercase' },
    ],
    substr: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
      { key: 'start', label: 'Start (optional)', type: 'text', placeholder: '1' },
      { key: 'end', label: 'End (optional)', type: 'text', placeholder: '' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.substr' },
    ],
    switch: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.localmem.val1' },
      { key: 'operator', label: 'Operator', type: 'text', placeholder: '!=' },
    ],
    trim: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
      { key: 'cutset', label: 'Cutset', type: 'text', placeholder: 'H' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.trim' },
    ],
  };

  const getFlowEditorJsonErrors = (draft: FlowNode | null) => {
    if (!draft || draft.kind !== 'processor') {
      return [] as Array<{ field: string; message: string }>;
    }
    const errors: Array<{ field: string; message: string }> = [];
    const specs = flowProcessorConfigSpecs[draft.processorType] || [];
    specs.forEach((spec) => {
      if (spec.type !== 'json') {
        return;
      }
      const valueKey = `${spec.key}Text`;
      const raw = String(draft.config?.[valueKey] ?? '').trim();
      if (!raw) {
        return;
      }
      try {
        JSON.parse(raw);
      } catch {
        errors.push({ field: spec.key, message: `${spec.label} must be valid JSON.` });
      }
    });
    if (draft.processorType === 'set') {
      const raw = String(draft.config?.argsText ?? '').trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            errors.push({ field: 'args', message: 'Args must be a JSON array.' });
          }
        } catch {
          errors.push({ field: 'args', message: 'Args must be valid JSON.' });
        }
      }
    }
    return errors;
  };

  const applyFlowEditorExample = () => {
    if (!flowEditorDraft) {
      return;
    }
    const key = flowEditorDraft.kind === 'if'
      ? 'if'
      : flowEditorDraft.processorType;
    const help = processorHelp[key];
    if (!help?.example) {
      return;
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(help.example);
    } catch {
      return;
    }
    const processorKey = Object.keys(parsed || {})[0];
    const payload = parsed?.[processorKey];
    if (!processorKey || !payload) {
      return;
    }
    if (flowEditorDraft.kind === 'if' && processorKey === 'if') {
      setFlowEditorDraft((prev) => (prev && prev.kind === 'if'
        ? {
          ...prev,
          condition: {
            property: String(payload.source ?? ''),
            operator: String(payload.operator ?? '=='),
            value: String(payload.value ?? ''),
          },
        }
        : prev));
      return;
    }
    if (flowEditorDraft.kind !== 'processor') {
      return;
    }
    const nextConfig: Record<string, any> = { ...(flowEditorDraft.config || {}) };
    Object.entries(payload).forEach(([field, value]) => {
      if (field === 'array' && Array.isArray(value)) {
        nextConfig.arrayText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'properties' && value && typeof value === 'object') {
        nextConfig.propertiesText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'fallback' && value && typeof value === 'object') {
        nextConfig.fallbackText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'args' && Array.isArray(value)) {
        nextConfig.argsText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'processors' || field === 'then' || field === 'else' || field === 'case' || field === 'default') {
        return;
      }
      nextConfig[field] = value;
    });
    setFlowEditorDraft((prev) => (prev && prev.kind === 'processor'
      ? {
        ...prev,
        config: nextConfig,
      }
      : prev));
  };
  const explicitFlags = permissionPaths
    .map((path) => getNestedValue(session?.ua_login, path))
    .filter((value) => value !== undefined);
  const recursiveFlags = findRulePermissionValues(session?.ua_login);
  const accessFlags = [...explicitFlags, ...recursiveFlags]
    .map((value) => parseAccessValue(value))
    .filter((value) => value !== null) as boolean[];
  const derivedEditRules = explicitFlags.some((value) => parsePermissionFlag(value))
    || recursiveFlags.some((value) => parsePermissionFlag(value))
    || accessFlags.some((value) => value);
  const canEditRules = typeof session?.can_edit_rules === 'boolean'
    ? session.can_edit_rules
    : derivedEditRules;

  useEffect(() => {
    if (viewMode === 'friendly') {
      return;
    }
    setPanelEditState({});
    setPanelDrafts({});
    setPanelEvalModes({});
    setPanelOverrideRemovals({});
    setPanelNavWarning({ open: false, fields: {} });
  }, [viewMode]);

  const ensureEventsSchema = async () => {
    if (eventsSchemaLoading || eventsSchemaFields.length > 0) {
      return;
    }
    setEventsSchemaLoading(true);
    setEventsSchemaError(null);
    try {
      const resp = await api.getEventsSchema();
      const fields = Array.isArray(resp.data?.fields) ? resp.data.fields.map(String) : [];
      setEventsSchemaFields(fields);
    } catch (err: any) {
      setEventsSchemaError(err?.response?.data?.error || 'Failed to load Events schema');
    } finally {
      setEventsSchemaLoading(false);
    }
  };
  useEffect(() => {
    if (!saveLoading) {
      setSaveElapsed(0);
      return;
    }
    setSaveElapsed(0);
    const interval = window.setInterval(() => {
      setSaveElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [saveLoading]);
  useEffect(() => {
    if (showFieldReferenceModal || eventFieldPickerOpen) {
      ensureEventsSchema();
    }
  }, [showFieldReferenceModal, eventFieldPickerOpen]);
  const isAnyPanelEditing = Object.values(panelEditState).some(Boolean);

  const togglePanelEdit = (key: string) => {
    setPanelEditState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateBuilderDraftField = (field: string, value: string) => {
    if (field === 'processorSource') {
      setProcessorDraft((prev) => ({
        ...prev,
        source: value,
      }));
    }
    if (field === 'processorTarget') {
      setProcessorDraft((prev) => ({
        ...prev,
        targetField: value,
      }));
    }
  };

  const handleProcessorSourceChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setProcessorDraft((prev) => ({
      ...prev,
      source: value,
    }));
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      const trapVars = obj?.trap?.variables || [];
      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
      setVarInsertContext({
        panelKey: builderTarget.panelKey,
        field: 'processorSource',
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
      setVarModalToken(varMatch.token);
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch || isPreGlobalFlow) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'processorSource',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleProcessorTargetChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setProcessorDraft((prev) => ({
      ...prev,
      targetField: value,
    }));
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'processorTarget',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleRegularEvalInputChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderRegularText(value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      setVarModalToken(varMatch.token);
      setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
      setVarInsertContext({
        panelKey: builderTarget.panelKey,
        field: 'builderRegular',
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'builderRegular',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const splitTopLevel = (expr: string, token: string) => {
    const parts: string[] = [];
    let depth = 0;
    let buffer = '';
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (ch === '(') {
        depth += 1;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && expr.slice(i, i + token.length) === token) {
        parts.push(buffer.trim());
        buffer = '';
        i += token.length - 1;
        continue;
      }
      buffer += ch;
    }
    if (buffer.trim()) {
      parts.push(buffer.trim());
    }
    return parts;
  };

  const parseConditionExpression = (expr: string): ConditionTree | null => {
    const cleaned = unwrapOuterParens(expr.trim());
    if (!cleaned) {
      return null;
    }
    const orParts = splitTopLevel(cleaned, '||');
    if (orParts.length > 1) {
      const children = orParts.map(parseConditionExpression);
      if (children.some((child) => !child)) {
        return null;
      }
      return {
        id: nextBuilderId(),
        type: 'group',
        operator: 'OR',
        children: children as ConditionTree[],
      };
    }
    const andParts = splitTopLevel(cleaned, '&&');
    if (andParts.length > 1) {
      const children = andParts.map(parseConditionExpression);
      if (children.some((child) => !child)) {
        return null;
      }
      return {
        id: nextBuilderId(),
        type: 'group',
        operator: 'AND',
        children: children as ConditionTree[],
      };
    }
    const match = cleaned.match(/^(.+?)(==|!=|>=|<=|>|<)(.+)$/);
    if (!match) {
      return null;
    }
    const [, left, operator, right] = match;
    return {
      id: nextBuilderId(),
      type: 'condition',
      left: left.trim(),
      operator,
      right: right.trim(),
    };
  };

  const parseEvalToRows = (text: string) => {
    const cleaned = unwrapOuterParens(text.trim());
    if (!cleaned) {
      return null;
    }
    const rows: BuilderConditionRow[] = [];
    let elseResult = '';
    const walk = (expr: string): boolean => {
      const node = splitTernary(unwrapOuterParens(expr.trim()));
      if (!node) {
        elseResult = expr.trim();
        return true;
      }
      const conditionNode = parseConditionExpression(node.condition);
      if (!conditionNode) {
        return false;
      }
      rows.push({
        id: nextBuilderId(),
        condition: conditionNode,
        result: node.whenTrue.trim(),
      });
      return walk(node.whenFalse);
    };
    if (!walk(cleaned)) {
      return null;
    }
    if (!elseResult || rows.length === 0) {
      return null;
    }
    return { rows, elseResult };
  };

  const ajv = useMemo(() => {
    const instance = new Ajv({ allErrors: true, strict: false });
    addFormats(instance);
    return instance;
  }, []);

  const validator = useMemo(() => {
    if (!schema) {
      return null;
    }
    try {
      return ajv.compile(schema);
    } catch {
      return null;
    }
  }, [ajv, schema]);

  const serverOptions = useMemo(
    () => servers.map((srv) => ({
      value: srv.server_id,
      label: srv.server_name,
    })),
    [servers],
  );

  const authOptions = useMemo(
    () => ([
      { value: 'basic', label: 'Basic (username/password)' },
      { value: 'certificate', label: 'Certificate' },
    ]),
    [],
  );

  useEffect(() => {
    const init = async () => {
      try {
        const sessionResp = await api.getSession();
        setSession(sessionResp.data);
      } catch {
        // no session
      }

      try {
        const serversResp = await api.listServers();
        setServers(serversResp.data);
        if (!serverId && serversResp.data.length > 0) {
          setServerId(serversResp.data[0].server_id);
        }
      } catch {
        setError('Failed to load server list');
      }
    };

    init();
  }, [setSession, setServers, serverId]);

  useEffect(() => {
    if (!isAuthenticated) {
      urlHydrated.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || schema || schemaLoading) {
      return;
    }
    const loadSchema = async () => {
      setSchemaError(null);
      setSchemaLoading(true);
      try {
        const resp = await api.getSchema();
        setSchema(resp.data);
      } catch (err: any) {
        setSchemaError(err?.response?.data?.error || 'Schema unavailable');
      } finally {
        setSchemaLoading(false);
      }
    };
    void loadSchema();
  }, [isAuthenticated, schema, schemaLoading]);

  useEffect(() => {
    if (!validator) {
      setValidationErrors([]);
      setJsonParseError(null);
      return;
    }
    const text = editorText.trim();
    if (!text) {
      setValidationErrors([]);
      setJsonParseError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setJsonParseError(null);
      try {
        const valid = validator(parsed);
        if (!valid) {
          const errors = (validator.errors || []).map((err) => ({
            path: err.instancePath || '/',
            message: err.message || 'Invalid value',
          }));
          setValidationErrors(errors);
        } else {
          setValidationErrors([]);
        }
      } catch (err: any) {
        setValidationErrors([]);
        setSchemaError(err?.message || 'Schema validation failed');
      }
    } catch (err: any) {
      setJsonParseError(err?.message || 'Invalid JSON');
      setValidationErrors([]);
    }
  }, [editorText, validator]);

  useEffect(() => {
    if (isAuthenticated && entries.length === 0 && !browseLoading && !urlHydrated.current) {
      loadNode(null, '/');
    }
  }, [isAuthenticated, entries.length, browseLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const loadFavorites = async () => {
      setFavoritesError(null);
      setFavoritesLoading(true);
      try {
        const resp = await api.getFavorites();
        setFavorites(resp.data?.favorites || []);
      } catch (err: any) {
        setFavoritesError(err?.response?.data?.error || 'Failed to load favorites');
      } finally {
        setFavoritesLoading(false);
      }
    };
    loadFavorites();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || urlHydrated.current) {
      return;
    }
    urlHydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    const nodeParam = params.get('node');
    const fileParam = params.get('file');
    const viewParam = params.get('view');

    if (viewParam === 'friendly' || viewParam === 'preview') {
      setViewMode(viewParam);
    }

    if (fileParam) {
      void openFileFromUrl(fileParam, nodeParam);
      return;
    }

    if (nodeParam) {
      setBreadcrumbs(buildBreadcrumbsFromNode(nodeParam));
      void loadNodeInternal(nodeParam);
      return;
    }

    void loadNodeInternal(null, '/');
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (browseNode) {
      params.set('node', browseNode);
    } else {
      params.delete('node');
    }
    if (selectedFile?.PathID) {
      params.set('file', selectedFile.PathID);
    } else {
      params.delete('file');
    }
    params.set('view', viewMode);
    if (session?.server_id) {
      params.set('server', session.server_id);
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [browseNode, selectedFile, viewMode, isAuthenticated, session?.server_id]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credentials = authType === 'basic'
        ? { username, password }
        : { cert_path: certPath, key_path: keyPath, ca_cert_path: caPath || undefined };

      const resp = await api.login(serverId, authType, credentials);
      // Debug: log login response payload (omit credentials)
      // eslint-disable-next-line no-console
      console.info('Login response:', resp?.data);
      setSession(resp.data);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Login error:', err?.response?.data || err);
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearSession();
      urlHydrated.current = false;
      setSelectedFile(null);
      setFileData(null);
      setEntries([]);
      setBrowseData(null);
      setBrowseNode(null);
      setBreadcrumbs([{ label: '/', node: null }]);
      setViewMode('preview');
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const confirmDiscardIfDirty = (action: () => void) => {
    const dirtyMap = getPanelDirtyMap();
    if (Object.keys(dirtyMap).length > 0) {
      setPanelNavWarning({ open: true, fields: dirtyMap });
      return false;
    }
    action();
    return true;
  };

  const isFavorite = (pathId: string, type: 'file' | 'folder') => (
    favorites.some((fav) => fav.pathId === pathId && fav.type === type)
  );

  const toggleFavorite = async (favorite: { type: 'file' | 'folder'; pathId: string; label: string; node?: string }) => {
    try {
      if (isFavorite(favorite.pathId, favorite.type)) {
        const resp = await api.removeFavorite({ type: favorite.type, pathId: favorite.pathId });
        setFavorites(resp.data?.favorites || []);
      } else {
        const resp = await api.addFavorite(favorite);
        setFavorites(resp.data?.favorites || []);
      }
    } catch (err: any) {
      setFavoritesError(err?.response?.data?.error || 'Failed to update favorites');
    }
  };

  const refreshSearchStatus = async () => {
    try {
      const resp = await api.getSearchStatus();
      setSearchStatus(resp.data);
    } catch {
      // ignore
    }
  };

  const stopSearchStatusPolling = () => {
    if (searchStatusPollRef.current !== null) {
      window.clearInterval(searchStatusPollRef.current);
      searchStatusPollRef.current = null;
    }
  };

  const startSearchStatusPolling = () => {
    stopSearchStatusPolling();
    searchStatusPollRef.current = window.setInterval(async () => {
      try {
        const resp = await api.getSearchStatus();
        setSearchStatus(resp.data);
        const lastBuilt = resp.data?.lastBuiltAt ? new Date(resp.data.lastBuiltAt).getTime() : null;
        const startedAt = searchRebuildStartRef.current;
        if (!resp.data?.isBuilding && lastBuilt && startedAt && lastBuilt >= startedAt - 1000) {
          setSearchRebuildPending(false);
          searchRebuildStartRef.current = null;
          stopSearchStatusPolling();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  };

  const runSearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const resp = await api.searchComs(query, searchScope, 200);
      setSearchResults(resp.data?.results || []);
      if (resp.data?.status) {
        setSearchStatus(resp.data.status);
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Search failed';
      setSearchError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    void runSearch(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handleResetNavigation = async () => {
    handleClearSearch();
    setSelectedFile(null);
    setSelectedFolder(null);
    setFileData(null);
    setFolderOverview(null);
    setBrowseNode(null);
    setBrowseData(null);
    setEntries([]);
    setBreadcrumbs([{ label: '/', node: null }]);
    setViewMode('preview');
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setSearchHighlightActive(false);
    await loadNodeInternal(null, '/');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery, searchScope, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void refreshSearchStatus();
    return () => stopSearchStatusPolling();
  }, [isAuthenticated]);

  const handleRebuildIndex = async () => {
    setSearchError(null);
    setSearchLoading(true);
    try {
      searchRebuildStartRef.current = Date.now();
      setSearchRebuildPending(true);
      const resp = await api.rebuildSearchIndex();
      setSearchStatus(resp.data);
      startSearchStatusPolling();
      const query = searchQuery.trim();
      if (query) {
        await runSearch(query);
      }
    } catch (err: any) {
      setSearchError(err?.response?.data?.error || 'Failed to rebuild index');
    } finally {
      setSearchLoading(false);
    }
  };

  const formatTime = (value?: string | null) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getSearchResultName = (result: any) => result?.name || result?.pathId?.split('/').pop() || result?.pathId;

  const loadNodeInternal = async (node: string | null, label?: string): Promise<boolean> => {
    setBrowseError(null);
    setBrowseLoading(true);
    try {
      const resp = await api.browsePath(browsePath, node ? { node } : undefined);
      setBrowseData(resp.data);
      setEntries(Array.isArray(resp.data?.data) ? resp.data.data : []);
      setBrowseNode(node);
      if (label !== undefined) {
        if (node === null) {
          setBreadcrumbs([{ label: '/', node: null }]);
        } else {
          setBreadcrumbs((prev) => [...prev, { label, node }]);
        }
      }
      return true;
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to load files');
      return false;
    } finally {
      setBrowseLoading(false);
    }
  };

  const loadNode = async (node: string | null, label?: string) => {
    if (!confirmDiscardIfDirty(() => loadNodeInternal(node, label))) {
      return;
    }
  };

  const buildBreadcrumbsFromNode = (node: string | null) => {
    if (!node) {
      return [{ label: '/', node: null }];
    }
    const segments = node.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; node: string | null }> = [{ label: '/', node: null }];
    let acc = '';
    segments.forEach((segment, index) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const label = index === 0 && segment.startsWith('id-') ? segment.replace(/^id-/, '') : segment;
      crumbs.push({ label, node: acc });
    });
    return crumbs;
  };

  const buildBreadcrumbsFromPath = (pathId: string) => {
    if (!pathId) {
      return [{ label: '/', node: null }];
    }
    const segments = pathId.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; node: string | null }> = [{ label: '/', node: null }];
    let acc = '';
    segments.forEach((segment, index) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const label = index === 0 && segment.startsWith('id-') ? segment.replace(/^id-/, '') : segment;
      crumbs.push({ label, node: acc });
    });
    return crumbs;
  };

  const isFolder = (entry: any) => {
    const icon = String(entry?.icon || '').toLowerCase();
    const name = String(entry?.PathName || '').toLowerCase();
    return (
      icon.includes('folder') ||
      icon.includes('sitemap') ||
      icon.includes('basket') ||
      (name.length > 0 && !name.endsWith('.json'))
    );
  };

  const handleCrumbClick = async (index: number) => {
    const crumb = breadcrumbs[index];
    confirmDiscardIfDirty(async () => {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      await loadNodeInternal(crumb.node ?? null);
    });
  };

  const handleOpenFileInternal = async (entry: any) => {
    if (!highlightNextOpenRef.current) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setSearchHighlightActive(false);
    }
    setSelectedFolder(null);
    setFolderOverview(null);
    setSelectedFile(entry);
    setFileError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setOverrideError(null);
    setOverrideInfo(null);
    setFileLoading(true);
    if (entry?.PathID) {
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
    }
    try {
      const resp = await api.readFile(entry.PathID);
      setFileData(resp.data);
      setOverrideLoading(true);
      try {
        const overridesResp = await api.getOverrides(entry.PathID);
        setOverrideInfo(overridesResp.data);
      } catch (err: any) {
        setOverrideError(err?.response?.data?.error || 'Failed to load overrides');
        setOverrideInfo(null);
      } finally {
        setOverrideLoading(false);
      }
      const ruleText = resp.data?.content?.data?.[0]?.RuleText;
      if (typeof ruleText === 'string') {
        try {
          const parsed = JSON.parse(ruleText);
          const formatted = JSON.stringify(parsed, null, 2);
          setEditorText(formatted);
          setOriginalText(formatted);
        } catch {
          setEditorText(ruleText);
          setOriginalText(ruleText);
        }
      } else {
        const formatted = JSON.stringify(getPreviewContent(resp.data), null, 2);
        setEditorText(formatted);
        setOriginalText(formatted);
      }
      setCommitMessage('');
      setViewMode('friendly');
    } catch (err: any) {
      setFileError(err?.response?.data?.error || 'Failed to load file');
    } finally {
      setFileLoading(false);
      highlightNextOpenRef.current = false;
    }
  };

  const handleOpenFile = async (entry: any) => {
    if (!confirmDiscardIfDirty(() => handleOpenFileInternal(entry))) {
      return;
    }
  };

  const handleOpenFolder = async (entry: any) => {
    if (!confirmDiscardIfDirty(() => handleOpenFolderInternal(entry))) {
      return;
    }
  };

  const handleOpenFolderInternal = async (entry: any) => {
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setSearchHighlightActive(false);
    setSelectedFile(null);
    setFileData(null);
    setOverrideInfo(null);
    setOverrideError(null);
    setSelectedFolder(entry);
    setFolderOverview(null);
    setFolderLoading(true);
    try {
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
      await loadNodeInternal(entry.PathID, entry.PathName);
      const resp = await api.getFolderOverview(entry.PathID, 25);
      setFolderOverview(resp.data);
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to load folder overview');
    } finally {
      setFolderLoading(false);
    }
  };

  const openFileFromUrl = async (fileId: string, nodeParam?: string | null) => {
    const fileName = fileId.split('/').pop() || fileId;
    const derivedParent = fileId.split('/').slice(0, -1).join('/');
    const parentNode = nodeParam || derivedParent;
    try {
      await handleOpenFileInternal({ PathID: fileId, PathName: fileName });
      if (parentNode) {
        try {
          const resp = await api.browsePath(browsePath, { node: parentNode });
          setBrowseData(resp.data);
          setEntries(Array.isArray(resp.data?.data) ? resp.data.data : []);
          setBrowseNode(parentNode);
        } catch {
          // ignore browse failures
        }
      }
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to restore file from URL');
    }
  };

  const favoritesFiles = favorites.filter((fav) => fav.type === 'file');
  const favoritesFolders = favorites.filter((fav) => fav.type === 'folder');

  const saveWithContent = async (content: any, message: string) => {
    if (!selectedFile) {
      return null;
    }
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    try {
      const etag = fileData?.etag || '';
      const commit = message.trim();
      const resp = await api.saveFile(selectedFile.PathID, content, etag, commit);
      setSaveSuccess('Saved successfully');
      setOriginalText(editorText);
      const refreshed = await api.readFile(selectedFile.PathID);
      setFileData(refreshed.data);
      if (resp?.data?.revision || resp?.data?.last_modified) {
        setSelectedFile({
          ...selectedFile,
          LastRevision: resp.data.revision ?? selectedFile.LastRevision,
          ModificationTime: resp.data.last_modified ?? selectedFile.ModificationTime,
        });
      }
      setViewMode('friendly');
      setShowCommitModal(false);
      return resp;
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save file');
      return null;
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveFile = async (message: string) => {
    const content = editorText.trim().startsWith('{') || editorText.trim().startsWith('[')
      ? JSON.parse(editorText)
      : editorText;
    await saveWithContent(content, message);
  };

  const handleSaveOverrides = async (message: string) => {
    if (!selectedFile || !pendingOverrideSave) {
      return;
    }
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    try {
      const resp = await api.saveOverrides(selectedFile.PathID, pendingOverrideSave, message.trim());
      setOverrideInfo(resp.data);
      setSaveSuccess('Overrides saved. Restart FCOM Processor required.');
      setPanelEditState({});
      setPanelDrafts({});
      setPanelOverrideRemovals({});
      setPanelNavWarning({ open: false, fields: {} });
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save overrides');
    } finally {
      setSaveLoading(false);
      setPendingOverrideSave(null);
    }
  };

  const getPreviewContent = (data: any) => {
    const ruleText = data?.content?.data?.[0]?.RuleText;
    if (typeof ruleText === 'string') {
      try {
        return JSON.parse(ruleText);
      } catch {
        return ruleText;
      }
    }
    return data?.content?.data?.[0] ?? data?.content ?? data ?? {};
  };

  const getFriendlyObjects = (data: any) => {
    const content = getPreviewContent(data);
    if (Array.isArray(content?.objects)) {
      return content.objects;
    }
    if (Array.isArray(content)) {
      return content;
    }
    return [];
  };

  const overrideIndex = useMemo(() => {
    const entries = Array.isArray(overrideInfo?.overrides) ? overrideInfo.overrides : [];
    const map = new Map<string, any[]>();
    entries.forEach((overrideEntry: any) => {
      const name = overrideEntry?.['@objectName'];
      if (!name) {
        return;
      }
      const list = map.get(name) || [];
      list.push(overrideEntry);
      map.set(name, list);
    });
    return map;
  }, [overrideInfo]);

  const getProcessorTargetField = (processor: any) => {
    if (!processor || typeof processor !== 'object') {
      return null;
    }
    const keys = [
      'set',
      'copy',
      'replace',
      'convert',
      'eval',
      'json',
      'lookup',
      'append',
      'sort',
      'split',
      'math',
      'regex',
      'grok',
      'rename',
      'strcase',
      'substr',
      'trim',
    ];
    for (const key of keys) {
      const target = processor?.[key]?.targetField;
      if (target) {
        return target;
      }
    }
    return null;
  };

  const getOverrideFlags = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return {
        event: false,
        trap: false,
        pre: false,
        any: false,
        advancedFlow: false,
      };
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    const event = targets.some((target) => target.startsWith('$.event.'));
    const trap = targets.some((target) => target.startsWith('$.trap.') || target.includes('trap.variables'));
    const pre = targets.some((target) => target.startsWith('$.preProcessors'));
    const hasProcessors = processors.length > 0;
    const hasUntargeted = processors.some((proc: any) => !getProcessorTargetField(proc));
    return {
      event,
      trap,
      pre,
      any: event || trap || pre || hasProcessors,
      advancedFlow: hasProcessors && (hasUntargeted || (!event && !trap && !pre)),
    };
  };

  const getOverrideTargets = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    return new Set<string>(targets);
  };

  const getOverrideValueMap = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Map<string, any>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const map = new Map<string, any>();
    processors.forEach((processor: any) => {
      const target = processor?.set?.targetField;
      if (target) {
        map.set(target, processor.set.source);
      }
    });
    return map;
  };

  const getEffectiveEventValue = (obj: any, field: string) => {
    const overrides = getOverrideValueMap(obj);
    const target = `$.event.${field}`;
    if (overrides.has(target)) {
      return overrides.get(target);
    }
    return obj?.event?.[field];
  };

  const getPanelDirtyFields = (obj: any, panelKey: string) => {
    const draft = panelDrafts?.[panelKey]?.event;
    if (!draft) {
      return [] as string[];
    }
    const removals = new Set(panelOverrideRemovals[panelKey] || []);
    const dirty: string[] = [];
    getEventFieldList(obj, panelKey).forEach((field) => {
      if (removals.has(field)) {
        dirty.push(field);
        return;
      }
      const original = getEffectiveEventValue(obj, field);
      const { display } = getEditableValue(original);
      if (String(draft[field] ?? '') !== String(display ?? '')) {
        dirty.push(field);
      }
    });
    return dirty;
  };

  const getEventOverrideFields = (obj: any) => {
    const overrideValueMap = getOverrideValueMap(obj);
    const fields: string[] = [];
    overrideValueMap.forEach((_value, target) => {
      if (target.startsWith('$.event.')) {
        fields.push(target.replace('$.event.', ''));
      }
    });
    return fields;
  };

  const getPanelDirtyMap = () => {
    const map: Record<string, string[]> = {};
    const objects = getFriendlyObjects(fileData);
    objects.forEach((obj: any, idx: number) => {
      const baseKey = getObjectKey(obj, idx);
      const panelKey = `${baseKey}:event`;
      if (!panelEditState[panelKey]) {
        return;
      }
      const dirty = getPanelDirtyFields(obj, panelKey);
      if (dirty.length > 0) {
        map[panelKey] = dirty;
      }
    });
    return map;
  };

  const isFieldHighlighted = (panelKey: string, field: string) => (
    panelNavWarning.fields?.[panelKey]?.includes(field)
  );

  const isEvalMode = (panelKey: string, field: string) => (
    panelEvalModes?.[panelKey]?.[field] ?? false
  );

  const isEvalValue = (value: any) => (
    value && typeof value === 'object' && typeof value.eval === 'string'
  );

  const shouldShowEvalToggle = (panelKey: string, field: string, obj: any) => (
    isEvalMode(panelKey, field) || isEvalValue(getEffectiveEventValue(obj, field))
  );

  const renderFieldBadges = (
    panelKey: string,
    field: string,
    obj: any,
    overrideTargets: Set<string>,
  ) => {
    const evalFlag = shouldShowEvalToggle(panelKey, field, obj);
    const processorFlag = overrideTargets.has(`$.event.${field}`);
    if (!evalFlag && !processorFlag) {
      return null;
    }
    return (
      <span className="field-badges">
        {evalFlag && <span className="pill status-pill status-pill-eval">Eval</span>}
        {processorFlag && <span className="pill status-pill status-pill-processor">Processor</span>}
      </span>
    );
  };

  const reservedEventFields = new Set(['EventID', 'EventKey', 'Method']);
  const baseEventFieldOrder = ['Node', 'Summary', 'Severity', 'EventType', 'EventCategory', 'ExpireTime'];
  const eventFieldDescriptions: Record<string, string> = {
    EventID: 'Database-managed ID; do not set or change this value.',
    EventKey: 'Rules-set de-duplication key used to match events in the live table.',
    EventCategory: '1=Resolution, 2=Problem, 3=Discrete; used by correlation logic.',
    EventType: 'Event type string used for correlation (e.g., linkUpDown).',
    Ack: 'Acknowledged flag (1=yes, 0=no).',
    Action: 'Non-human process that made a change (mechanizations/tools).',
    Actor: 'Entity or user that caused the change.',
    Count: 'De-dup count; incremented for duplicate events only.',
    Customer: 'Customer identifier.',
    Department: 'Department label; defaulted if missing.',
    Details: 'JSON text for extra details (replaces Custom1–5).',
    DeviceType: 'General device category; defaulted if missing.',
    Duration: 'Time between FirstReported and LastChanged.',
    EscalationFlag: 'Escalation state: 0=no, 1=pending, 2=escalated.',
    ExpireTime: 'Seconds after LastChanged before eligible for delete.',
    FirstReported: 'Epoch ms when the event first occurred.',
    IPAddress: 'Device IP address; defaults to 0.0.0.0 if missing.',
    LastChanged: 'Epoch ms when the event was last updated.',
    LastReported: 'Epoch ms when the event last occurred.',
    Location: 'Location name/address used by analytics.',
    Method: 'Protocol/source that received the event (e.g., Trapd, Syslogd).',
    Node: 'Device name (often DNS), derived from IP lookup.',
    OrigSeverity: 'Original severity at creation.',
    OwnerName: 'Current owner/assignee username.',
    RootCauseFlag: 'Flag indicating the event is a root cause.',
    RootCauseID: 'EventID of the root cause event.',
    Score: 'Ranking score (often Severity × Priority).',
    Service: 'SLM service name when a violation is detected.',
    ServiceImpact: 'Service impact indicator/level.',
    Severity: 'Severity 0–5 for display and routing.',
    SubDeviceType: 'Vendor/model information; defaulted if missing.',
    SubMethod: 'Specific processing label (e.g., MIB name).',
    SubNode: 'Event instance (e.g., ifIndex) used for correlation.',
    Summary: 'Free-form summary shown in the event list.',
    TicketFlag: 'Ticket state: 0=none, 1=create, 2=processing, 3=opened.',
    TicketID: 'External ticket ID.',
    ZoneID: 'Device zone identifier.',
  };

  const getExistingEventFields = (obj: any, panelKey: string) => {
    const fields = new Set<string>();
    Object.keys(obj?.event || {}).forEach((field) => fields.add(field));
    getEventOverrideFields(obj).forEach((field) => fields.add(field));
    (panelAddedFields[panelKey] || []).forEach((field) => fields.add(field));
    return fields;
  };

  const getBaseEventFields = (obj: any, panelKey: string) => {
    const existing = getExistingEventFields(obj, panelKey);
    return baseEventFieldOrder.filter((field) => existing.has(field));
  };

  const getAdditionalEventFields = (obj: any, panelKey: string) => {
    const existing = Array.from(getExistingEventFields(obj, panelKey));
    const baseFields = new Set(getBaseEventFields(obj, panelKey));
    return existing.filter((field) => !baseFields.has(field) && !reservedEventFields.has(field));
  };

  const getEventFieldList = (obj: any, panelKey: string) => (
    [...getBaseEventFields(obj, panelKey), ...getAdditionalEventFields(obj, panelKey)]
  );

  const formatEventFieldLabel = (field: string) => (
    field.replace(/([a-z])([A-Z])/g, '$1 $2')
  );
  const getEventFieldDescription = (field: string) => eventFieldDescriptions[field] || '';

  const openAddFieldModal = (panelKey: string, obj: any) => {
    setAddFieldContext({ panelKey, obj });
    setShowAddFieldModal(true);
    setAddFieldSearch('');
    ensureEventsSchema();
  };

  const addFieldToPanel = (field: string) => {
    if (!addFieldContext) {
      return;
    }
    const { panelKey } = addFieldContext;
    setPanelAddedFields((prev) => {
      const existing = new Set(prev[panelKey] || []);
      existing.add(field);
      return { ...prev, [panelKey]: Array.from(existing) };
    });
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: '',
        },
      },
    }));
    setPanelEvalModes((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        [field]: false,
      },
    }));
    setShowAddFieldModal(false);
  };

  const isFieldDirty = (obj: any, panelKey: string, field: string) => {
    const removals = new Set(panelOverrideRemovals[panelKey] || []);
    if (removals.has(field)) {
      return true;
    }
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    const original = getEffectiveEventValue(obj, field);
    const { display } = getEditableValue(original);
    return String(draftValue ?? '') !== String(display ?? '');
  };

  const getEditableValue = (value: any) => {
    if (value === null || value === undefined) {
      return { editable: true, display: '', isEval: false };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return { editable: true, display: String(value), isEval: false };
    }
    if (typeof value === 'object' && typeof value.eval === 'string') {
      return { editable: true, display: value.eval, isEval: true };
    }
    return { editable: true, display: JSON.stringify(value), isEval: false };
  };

  const getBaseEventDisplay = (obj: any, field: string) => {
    const baseValue = obj?.event?.[field];
    const { display } = getEditableValue(baseValue);
    return display || '—';
  };

  const startEventEdit = (obj: any, key: string) => {
    const draft: Record<string, any> = {};
    const evalModes: Record<string, boolean> = {};
    getEventFieldList(obj, key).forEach((field) => {
      const value = getEffectiveEventValue(obj, field);
      const { display, isEval } = getEditableValue(value);
      draft[field] = display;
      evalModes[field] = Boolean(isEval);
    });
    setPanelDrafts((prev) => ({
      ...prev,
      [key]: { event: draft },
    }));
    setPanelEvalModes((prev) => ({
      ...prev,
      [key]: evalModes,
    }));
    setPanelEditState((prev) => ({ ...prev, [key]: true }));
    setBuilderOpen(true);
  };

  const cancelEventEdit = (key: string) => {
    setPanelDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelEditState((prev) => ({ ...prev, [key]: false }));
    setPanelEvalModes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelNavWarning((prev) => {
      if (!prev.fields[key]) {
        return prev;
      }
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      return { ...prev, fields: nextFields };
    });
    if (builderTarget?.panelKey === key) {
      closeBuilder();
    }
  };

  const buildOverrideSetProcessor = (field: string, value: any) => ({
    set: {
      source: value,
      targetField: `$.event.${field}`,
    },
  });

  const saveEventEdit = async (obj: any, key: string) => {
    if (!selectedFile) {
      return;
    }
    const draft = panelDrafts?.[key]?.event || {};
    const removalFields = new Set(panelOverrideRemovals[key] || []);
    const updates: { field: string; value: any }[] = [];
    getEventFieldList(obj, key).forEach((field) => {
      const original = getEffectiveEventValue(obj, field);
      const draftValue = draft[field];
      const { display } = getEditableValue(original);
      if (String(draftValue ?? '') !== String(display ?? '')) {
        let value: any = draftValue;
        if (!isEvalMode(key, field) && draftValue !== '' && !Number.isNaN(Number(draftValue)) && field !== 'Summary') {
          value = Number(draftValue);
        }
        if (isEvalMode(key, field)) {
          value = { eval: String(draftValue ?? '') };
        }
        updates.push({ field, value });
      }
    });

    if (updates.length === 0 && removalFields.size === 0) {
      setSaveError(null);
      setSaveSuccess('No changes made.');
      return;
    }

    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }

    const existingOverrides = Array.isArray(overrideInfo?.overrides) ? [...overrideInfo.overrides] : [];
    const method = overrideInfo?.method || (String(selectedFile.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
    const scope = 'post';
    const matchIndex = existingOverrides.findIndex((entry: any) => (
      entry?.['@objectName'] === objectName && entry?.method === method && entry?.scope === scope
    ));

    const overrideEntry = matchIndex >= 0
      ? { ...existingOverrides[matchIndex] }
      : {
        name: `${objectName} Override`,
        description: `Overrides for ${objectName}`,
        domain: 'fault',
        method,
        scope,
        '@objectName': objectName,
        _type: 'override',
        processors: [],
      };

    let processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];

    if (removalFields.size > 0) {
      processors = processors.filter((proc: any) => {
        const target = getProcessorTargetField(proc);
        if (!target) {
          return true;
        }
        const field = target.replace('$.event.', '');
        return !removalFields.has(field);
      });
    }

    updates.forEach(({ field, value }) => {
      if (removalFields.has(field)) {
        return;
      }
      const targetField = `$.event.${field}`;
      const existingIdx = processors.findIndex((proc: any) => {
        const target = getProcessorTargetField(proc);
        return target === targetField && proc?.set;
      });
      const newProcessor = buildOverrideSetProcessor(field, value);
      if (existingIdx >= 0) {
        processors[existingIdx] = newProcessor;
      } else {
        processors.push(newProcessor);
      }
    });

    if (processors.length === 0) {
      if (matchIndex >= 0) {
        existingOverrides.splice(matchIndex, 1);
      }
    } else {
      overrideEntry.processors = processors;
      if (matchIndex >= 0) {
        existingOverrides[matchIndex] = overrideEntry;
      } else {
        existingOverrides.push(overrideEntry);
      }
    }

    setPendingOverrideSave(existingOverrides);
    setCommitMessage('');
    setShowCommitModal(true);
    setPanelNavWarning((prev) => {
      if (!prev.fields[key]) {
        return prev;
      }
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      return { ...prev, fields: nextFields };
    });
  };

  const openRemoveOverrideModal = (obj: any, field: string, panelKey: string) => {
    const original = obj?.event?.[field];
    const { display } = getEditableValue(original);
    setRemoveOverrideModal({
      open: true,
      objectName: obj?.['@objectName'],
      field,
      baseValue: display || '—',
      panelKey,
    });
  };

  const confirmRemoveOverride = () => {
    if (!removeOverrideModal.objectName || !removeOverrideModal.field || !removeOverrideModal.panelKey) {
      setRemoveOverrideModal({ open: false });
      return;
    }

    const panelKey = removeOverrideModal.panelKey;
    const field = removeOverrideModal.field;

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      list.add(field);
      next[panelKey] = Array.from(list);
      return next;
    });

    if (!panelEditState[panelKey]) {
      const objKey = panelKey.replace(/:event$/, '');
      const objects = getFriendlyObjects(fileData);
      const obj = objects.find((item: any, idx: number) => getObjectKey(item, idx) === objKey);
      if (obj) {
        startEventEdit(obj, panelKey);
      }
    }

    setPanelDrafts((prev) => {
      const next = { ...prev };
      const current = next[panelKey]?.event || {};
      next[panelKey] = {
        ...next[panelKey],
        event: {
          ...current,
          [field]: removeOverrideModal.baseValue ?? '',
        },
      };
      return next;
    });

    setRemoveOverrideModal({ open: false });
  };

  const openRemoveAllOverridesModal = (obj: any, panelKey: string) => {
    const fields = getEventOverrideFields(obj);
    if (fields.length === 0) {
      return;
    }
    const baseValues: Record<string, string> = {};
    fields.forEach((field) => {
      const original = obj?.event?.[field];
      const { display } = getEditableValue(original);
      baseValues[field] = display || '—';
    });
    setRemoveAllOverridesModal({
      open: true,
      panelKey,
      fields,
      baseValues,
    });
  };

  const confirmRemoveAllOverrides = () => {
    if (!removeAllOverridesModal.panelKey || !removeAllOverridesModal.fields) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }

    const panelKey = removeAllOverridesModal.panelKey;
    const fields = removeAllOverridesModal.fields;

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      fields.forEach((field) => list.add(field));
      next[panelKey] = Array.from(list);
      return next;
    });

    if (!panelEditState[panelKey]) {
      const objKey = panelKey.replace(/:event$/, '');
      const objects = getFriendlyObjects(fileData);
      const obj = objects.find((item: any, idx: number) => getObjectKey(item, idx) === objKey);
      if (obj) {
        startEventEdit(obj, panelKey);
      }
    }

    setPanelDrafts((prev) => {
      const next = { ...prev };
      const current = next[panelKey]?.event || {};
      const baseValues = removeAllOverridesModal.baseValues || {};
      const merged = { ...current };
      fields.forEach((field) => {
        merged[field] = baseValues[field] ?? '';
      });
      next[panelKey] = {
        ...next[panelKey],
        event: merged,
      };
      return next;
    });

    setRemoveAllOverridesModal({ open: false });
  };

  const getObjectKey = (obj: any, index: number) => {
    const name = obj?.['@objectName'];
    return name ? `name:${name}` : `idx:${index}`;
  };

  const scrollToRef = (target?: HTMLDivElement | null) => {
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const scrollToMatchIndex = (index: number) => {
    if (index < 0 || index >= highlightObjectKeys.length) {
      return;
    }
    const key = highlightObjectKeys[index];
    scrollToRef(objectRowRefs.current[key]);
  };

  const shouldHighlightTerm = () => Boolean(searchHighlightActive && highlightQuery);

  const renderHighlightedText = (text: string) => {
    if (!shouldHighlightTerm() || !highlightQuery) {
      return text;
    }
    const query = highlightQuery.trim();
    if (!query) {
      return text;
    }
    const lower = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lower.includes(lowerQuery)) {
      return text;
    }
    const parts: React.ReactNode[] = [];
    let start = 0;
    while (true) {
      const idx = lower.indexOf(lowerQuery, start);
      if (idx === -1) {
        break;
      }
      if (idx > start) {
        parts.push(text.slice(start, idx));
      }
      parts.push(
        <span key={`match-${idx}`} className="match-highlight">
          {text.slice(idx, idx + query.length)}
        </span>,
      );
      start = idx + query.length;
    }
    if (start < text.length) {
      parts.push(text.slice(start));
    }
    return parts;
  };

  const renderValue = (value: any, trapVars?: any[]) => {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value);
      if (typeof value === 'string' && text.includes('$v')) {
        return renderEvalLineWithVars(text, trapVars);
      }
      return renderHighlightedText(text);
    }
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return renderEvalDisplay(value.eval, trapVars);
    }
    try {
      return renderHighlightedText(JSON.stringify(value));
    } catch {
      return '—';
    }
  };

  const getEvalText = (value: any) => {
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return value.eval;
    }
    return typeof value === 'string' ? value : '';
  };

  const getVarInsertMatch = (value: string, cursorIndex: number | null) => {
    if (cursorIndex === null) {
      return null;
    }
    const prefix = value.slice(0, cursorIndex);
    const match = prefix.match(/\$v\d*$/);
    if (!match) {
      return null;
    }
    const start = prefix.lastIndexOf(match[0]);
    return { token: match[0], replaceStart: start, replaceEnd: cursorIndex };
  };

  const getEventFieldInsertMatch = (value: string, cursorIndex: number | null) => {
    if (cursorIndex === null) {
      return null;
    }
    const prefix = value.slice(0, cursorIndex);
    const match = prefix.match(/\$\.event\.?[A-Za-z0-9_]*$/);
    if (!match) {
      return null;
    }
    const start = prefix.lastIndexOf(match[0]);
    const token = match[0];
    const rawQuery = token.replace('$.event', '').replace(/^\./, '');
    return {
      token,
      query: rawQuery,
      replaceStart: start,
      replaceEnd: cursorIndex,
    };
  };

  const handleVarInsertSelect = (token: string) => {
    if (!varInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd } = varInsertContext;
    const nextValue = `${value.slice(0, replaceStart)}${token}${value.slice(replaceEnd)}`;
    if (panelKey === '__flow__') {
      setFlowEditorDraft((prev) => {
        if (!prev) {
          return prev;
        }
        if (field === 'flowEditor.source') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              source: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.targetField') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              targetField: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.pattern') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              pattern: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.property' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              property: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.value' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              value: nextValue,
            },
          } as FlowNode;
        }
        return prev;
      });
    } else if (field === 'processorSource' || field === 'processorTarget') {
      updateBuilderDraftField(field, nextValue);
    } else if (field === 'builderLiteral') {
      setBuilderLiteralText(nextValue);
    } else if (field === 'builderRegular') {
      setBuilderRegularText(nextValue);
    } else {
      setPanelDrafts((prev) => ({
        ...prev,
        [panelKey]: {
          ...prev[panelKey],
          event: {
            ...prev[panelKey]?.event,
            [field]: nextValue,
          },
        },
      }));
    }
    setVarModalOpen(false);
    setVarModalMode('view');
    setVarInsertContext(null);
    setVarModalToken(null);
  };

  const handleEventFieldInsertSelect = (fieldName: string) => {
    if (!eventFieldInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd } = eventFieldInsertContext;
    if (panelKey === '__flow__' && isPreGlobalFlow) {
      setEventFieldPickerOpen(false);
      setEventFieldInsertContext(null);
      return;
    }
    const insertToken = `$.event.${fieldName}`;
    const nextValue = `${value.slice(0, replaceStart)}${insertToken}${value.slice(replaceEnd)}`;
    if (panelKey === '__flow__') {
      setFlowEditorDraft((prev) => {
        if (!prev) {
          return prev;
        }
        if (field === 'flowEditor.source') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              source: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.targetField') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              targetField: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.pattern') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              pattern: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.property' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              property: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.value' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              value: nextValue,
            },
          } as FlowNode;
        }
        return prev;
      });
    } else if (field === 'processorSource') {
      updateBuilderDraftField(field, nextValue);
    } else if (field === 'builderLiteral') {
      setBuilderLiteralText(nextValue);
    } else if (field === 'builderRegular') {
      setBuilderRegularText(nextValue);
    } else {
      setPanelDrafts((prev) => ({
        ...prev,
        [panelKey]: {
          ...prev[panelKey],
          event: {
            ...prev[panelKey]?.event,
            [field]: nextValue,
          },
        },
      }));
    }
    setEventFieldPickerOpen(false);
    setEventFieldInsertContext(null);
  };

  const handleFlowEditorInputChange = (
    fieldKey: 'flowEditor.source' | 'flowEditor.targetField' | 'flowEditor.pattern'
    | 'flowEditor.condition.property' | 'flowEditor.condition.value',
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setFlowEditorDraft((prev) => {
      if (!prev) {
        return prev;
      }
      if (fieldKey === 'flowEditor.source') {
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            source: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.targetField') {
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            targetField: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.pattern') {
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            pattern: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.condition.property' && prev.kind === 'if') {
        return {
          ...prev,
          condition: {
            ...prev.condition,
            property: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.condition.value' && prev.kind === 'if') {
        return {
          ...prev,
          condition: {
            ...prev.condition,
            value,
          },
        } as FlowNode;
      }
      return prev;
    });

    if (inputType && !inputType.startsWith('insert')) {
      return;
    }

    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = builderTarget ? getObjectByPanelKey(builderTarget.panelKey) : null;
      const trapVars = obj?.trap?.variables || [];
      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
      setVarInsertContext({
        panelKey: '__flow__',
        field: fieldKey,
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
      setVarModalToken(varMatch.token);
      return;
    }

    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: '__flow__',
      field: fieldKey,
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleLiteralInputChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderLiteralText(value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const match = getVarInsertMatch(value, cursorIndex);
    if (!match) {
      const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
      if (!eventMatch) {
        return;
      }
      setEventFieldSearch(eventMatch.query || '');
      setEventFieldInsertContext({
        panelKey: builderTarget.panelKey,
        field: 'builderLiteral',
        value,
        replaceStart: eventMatch.replaceStart,
        replaceEnd: eventMatch.replaceEnd,
      });
      setEventFieldPickerOpen(true);
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    setVarModalToken(match.token);
    setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
    setVarModalMode('insert');
    setVarInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'builderLiteral',
      value,
      replaceStart: match.replaceStart,
      replaceEnd: match.replaceEnd,
    });
    setVarModalOpen(true);
  };

  const handleEventInputChange = (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: value,
        },
      },
    }));

    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const match = getVarInsertMatch(value, cursorIndex);
    if (match) {
      setVarModalToken(match.token);
      setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
      setVarModalMode('insert');
      setVarInsertContext({
        panelKey,
        field,
        value,
        replaceStart: match.replaceStart,
        replaceEnd: match.replaceEnd,
      });
      setVarModalOpen(true);
      return;
    }

    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey,
      field,
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const openBuilderForField = (obj: any, panelKey: string, field: string) => {
    if (!panelEditState[panelKey]) {
      startEventEdit(obj, panelKey);
    }
    const overrideProcessors = (() => {
      const objectName = obj?.['@objectName'];
      if (!objectName) {
        return [];
      }
      const overrides = Array.isArray(overrideInfo?.overrides) ? overrideInfo.overrides : [];
      const method = overrideInfo?.method || (String(selectedFile?.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
      const scope = 'post';
      const entry = overrides.find((item: any) => (
        item?.['@objectName'] === objectName && item?.method === method && item?.scope === scope
      ));
      return Array.isArray(entry?.processors) ? entry.processors : [];
    })();
    const targetPath = `$.event.${field}`;
    const existingProcessor = overrideProcessors.find((proc: any) => getProcessorTargetField(proc) === targetPath);
    const evalValue = getEffectiveEventValue(obj, field);
    const evalText = typeof evalValue === 'object' && typeof evalValue.eval === 'string'
      ? evalValue.eval
      : typeof evalValue === 'string'
        ? evalValue.trim()
        : '';

    setBuilderTarget({ panelKey, field });
    setBuilderOpen(true);
    setShowProcessorJson(true);
    if (existingProcessor?.regex) {
      setBuilderFocus('processor');
      setBuilderTypeLocked('processor');
      setProcessorType('regex');
      setProcessorStep('configure');
      setProcessorDraft({
        sourceType: existingProcessor.regex?.source?.startsWith('$.') ? 'path' : 'literal',
        source: String(existingProcessor.regex?.source ?? ''),
        pattern: String(existingProcessor.regex?.pattern ?? ''),
        targetField: existingProcessor.regex?.targetField ?? targetPath,
      });
      return;
    }
    if (existingProcessor?.set) {
      setBuilderFocus('processor');
      setBuilderTypeLocked('processor');
      setProcessorType('set');
      setProcessorStep('configure');
      setProcessorDraft({
        sourceType: existingProcessor.set?.source?.startsWith('$.') ? 'path' : 'literal',
        source: String(existingProcessor.set?.source ?? ''),
        pattern: '',
        targetField: existingProcessor.set?.targetField ?? targetPath,
      });
      return;
    }
    const evalEnabled = isEvalMode(panelKey, field)
      || (typeof evalValue === 'object' && typeof evalValue.eval === 'string');
    if (evalEnabled && evalText) {
      const parsed = parseEvalToRows(evalText);
      setBuilderFocus('eval');
      setBuilderTypeLocked('eval');
      if (parsed) {
        setBuilderMode('friendly');
        setBuilderConditions(parsed.rows);
        setBuilderElseResult(parsed.elseResult);
      } else {
        setBuilderMode('regular');
      }
      setBuilderRegularText(evalText);
      return;
    }
    if (!evalEnabled) {
      setBuilderFocus('literal');
      setBuilderTypeLocked('literal');
      setBuilderLiteralText(getCurrentFieldValue(obj, panelKey, field));
      return;
    }
    setBuilderFocus(null);
    setProcessorStep('select');
    setProcessorType(null);
    setProcessorDraft({
      sourceType: 'literal',
      source: '',
      pattern: '',
      targetField: targetPath,
    });
  };

  const updatePanelDraftField = (panelKey: string, field: string, value: string) => {
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: value,
        },
      },
    }));
  };

  const setEvalModeForField = (panelKey: string, field: string, enabled: boolean) => {
    setPanelEvalModes((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        [field]: enabled,
      },
    }));
  };

  const isBuilderTargetReady = builderTarget && panelEditState[builderTarget.panelKey];
  const isFieldLockedByBuilder = (panelKey: string, field: string) => (
    Boolean(builderTarget
      && panelEditState[builderTarget.panelKey]
      && builderTarget.panelKey === panelKey
      && builderTarget.field !== field)
  );
  const getCurrentFieldValue = (obj: any, panelKey: string, field: string) => {
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    if (draftValue !== undefined) {
      return String(draftValue ?? '');
    }
    const original = getEffectiveEventValue(obj, field);
    const { display } = getEditableValue(original);
    return String(display ?? '');
  };
  const getLiteralEligibility = () => {
    if (!builderTarget) {
      return { eligible: false, value: '' };
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return { eligible: false, value: '' };
    }
    if (isEvalMode(builderTarget.panelKey, builderTarget.field)) {
      return { eligible: false, value: '' };
    }
    const original = getEffectiveEventValue(obj, builderTarget.field);
    const { display, isEval } = getEditableValue(original);
    const eligible = !isEval
      && (typeof original === 'string' || typeof original === 'number' || original == null);
    return { eligible, value: String(display ?? '') };
  };
  const closeBuilder = () => {
    setBuilderTarget(null);
    setBuilderFocus(null);
    setProcessorStep('select');
    setProcessorType(null);
    setBuilderLiteralText('');
    setBuilderTypeLocked(null);
    setBuilderSwitchModal({ open: false });
  };

  const applyBuilderTypeSwitch = (target: 'eval' | 'processor' | 'literal') => {
    if (!builderTarget) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    if (target === 'literal') {
      setBuilderLiteralText(getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field));
      setBuilderFocus('literal');
    }
    if (target === 'eval') {
      const baseValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
      setBuilderMode('regular');
      setBuilderRegularText(baseValue);
      setBuilderFocus('eval');
    }
    if (target === 'processor') {
      setProcessorStep('select');
      setProcessorType(null);
      setBuilderFocus('processor');
    }
    setBuilderTypeLocked(target);
  };

  const getObjectByPanelKey = (panelKey: string) => {
    const baseKey = panelKey.includes(':')
      ? panelKey.slice(0, panelKey.lastIndexOf(':'))
      : panelKey;
    const objects = getFriendlyObjects(fileData);
    for (let idx = 0; idx < objects.length; idx += 1) {
      if (getObjectKey(objects[idx], idx) === baseKey) {
        return objects[idx];
      }
    }
    return null;
  };

  const normalizeTargetField = (value: string, fallbackField?: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('$.')) {
      return trimmed;
    }
    if (!trimmed && fallbackField) {
      return `$.event.${fallbackField}`;
    }
    return `$.event.${trimmed}`;
  };

  const normalizeSourcePath = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('$.')) {
      return trimmed;
    }
    if (!trimmed) {
      return '';
    }
    return `$.event.${trimmed}`;
  };

  const buildProcessorPayload = () => {
    if (!processorType || !builderTarget) {
      return null;
    }
    const targetField = normalizeTargetField(processorDraft.targetField, builderTarget.field);
    if (processorType === 'set') {
      const sourceValue = processorDraft.sourceType === 'path'
        ? normalizeSourcePath(processorDraft.source)
        : processorDraft.source;
      return {
        set: {
          source: sourceValue,
          targetField,
        },
      };
    }
    if (processorType === 'regex') {
      const sourceValue = processorDraft.sourceType === 'path'
        ? normalizeSourcePath(processorDraft.source)
        : processorDraft.source;
      return {
        regex: {
          source: sourceValue,
          pattern: processorDraft.pattern,
          targetField,
        },
      };
    }
    return null;
  };

  type ProcessorCatalogItem = {
    id: string;
    label: string;
    nodeKind: 'processor' | 'if';
    status: 'working' | 'testing' | 'planned';
    paletteLabel?: string;
    builderEnabled: boolean;
    helpKey: keyof typeof processorHelp;
  };

  const processorCatalog: ProcessorCatalogItem[] = [
    {
      id: 'set',
      label: 'Set',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'set',
    },
    {
      id: 'regex',
      label: 'Regex',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'regex',
    },
    {
      id: 'if',
      label: 'If',
      paletteLabel: 'If (Flow)',
      nodeKind: 'if',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'if',
    },
    {
      id: 'append',
      label: 'Append',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'append',
    },
    {
      id: 'appendToOutputStream',
      label: 'Append to Output Stream',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'appendToOutputStream',
    },
    {
      id: 'break',
      label: 'Break',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'break',
    },
    {
      id: 'convert',
      label: 'Convert',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'convert',
    },
    {
      id: 'copy',
      label: 'Copy',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'copy',
    },
    {
      id: 'discard',
      label: 'Discard',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'discard',
    },
    {
      id: 'eval',
      label: 'Eval',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'eval',
    },
    {
      id: 'foreach',
      label: 'Foreach',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'foreach',
    },
    {
      id: 'grok',
      label: 'Grok',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'grok',
    },
    {
      id: 'json',
      label: 'JSON',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'json',
    },
    {
      id: 'log',
      label: 'Log',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'log',
    },
    {
      id: 'lookup',
      label: 'Lookup',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'lookup',
    },
    {
      id: 'math',
      label: 'Math',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'math',
    },
    {
      id: 'remove',
      label: 'Remove',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'remove',
    },
    {
      id: 'rename',
      label: 'Rename',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'rename',
    },
    {
      id: 'replace',
      label: 'Replace',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'replace',
    },
    {
      id: 'setOutputStream',
      label: 'Set Output Stream',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'setOutputStream',
    },
    {
      id: 'sort',
      label: 'Sort',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'sort',
    },
    {
      id: 'split',
      label: 'Split',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'split',
    },
    {
      id: 'strcase',
      label: 'String Case',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'strcase',
    },
    {
      id: 'substr',
      label: 'Substring',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'substr',
    },
    {
      id: 'switch',
      label: 'Switch',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'switch',
    },
    {
      id: 'trim',
      label: 'Trim',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'trim',
    },
  ];

  const flowPalette: Array<{
    label: string;
    nodeKind: 'processor' | 'if';
    processorType?: string;
    status: 'working' | 'testing' | 'planned';
  }> = processorCatalog.map((item) => ({
    label: item.paletteLabel || item.label,
    nodeKind: item.nodeKind,
    processorType: item.nodeKind === 'processor' ? item.id : undefined,
    status: item.status,
  }));
  const paletteSearch = advancedProcessorSearch.trim().toLowerCase();
  const filteredFlowPalette = flowPalette.filter((item) => (
    item.label.toLowerCase().includes(paletteSearch)
  ));
  const paletteSections = [
    { title: 'Working', status: 'working' as const },
    { title: 'Testing', status: 'testing' as const },
    { title: 'Planned', status: 'planned' as const },
  ].map((section) => ({
    ...section,
    items: filteredFlowPalette.filter((item) => item.status === section.status),
  }));

  const getFlowNodeLabel = (node: FlowNode) => {
    if (node.kind === 'if') {
      return 'If';
    }
    const item = flowPalette.find((entry) => entry.processorType === node.processorType);
    return item?.label || node.processorType;
  };

  const handleFlowDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleFlowDrop = (
    event: React.DragEvent<HTMLElement>,
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const payloadRaw = event.dataTransfer.getData('application/json')
      || event.dataTransfer.getData('text/plain');
    if (!payloadRaw) {
      return;
    }
    let payload: any = null;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (payload.source === 'palette') {
      const newNode = createFlowNode(payload);
      setNodes((prev) => appendNodeAtPath(prev, path, newNode));
      return;
    }
    if (payload.source === 'flow' && payload.nodeId) {
      setNodes((prev) => {
        const { nodes, removed } = removeNodeById(prev, payload.nodeId);
        if (!removed) {
          return prev;
        }
        return appendNodeAtPath(nodes, path, removed);
      });
    }
  };

  const renderFlowList = (
    nodes: FlowNode[],
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
  ) => (
    <div
      className="flow-lane"
      onDragOver={handleFlowDragOver}
      onDrop={(event) => handleFlowDrop(event, path, setNodes)}
    >
      {nodes.length === 0 && (
        <div className="flow-empty">Drop processors here</div>
      )}
      {nodes.map((node) => (
        <div
          key={node.id}
          className={node.kind === 'if' ? 'flow-node flow-node-if' : 'flow-node'}
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
            <div className="flow-node-title">{getFlowNodeLabel(node)}</div>
            <div className="flow-node-actions">
              <button
                type="button"
                className="flow-node-edit"
                onClick={() => openFlowEditor(node.id, scope, lane, nodes, setNodes)}
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
                {renderFlowList(node.then, { kind: 'if', id: node.id, branch: 'then' }, setNodes, scope, lane)}
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Else</div>
                {renderFlowList(node.else, { kind: 'if', id: node.id, branch: 'else' }, setNodes, scope, lane)}
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'foreach' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Per-item processors</div>
                {renderFlowList(
                  Array.isArray(node.config?.processors)
                    ? node.config.processors
                    : [],
                  { kind: 'foreach', id: node.id, branch: 'processors' },
                  setNodes,
                  scope,
                  lane,
                )}
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'switch' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Cases</div>
                {(Array.isArray(node.config?.cases) ? node.config.cases : []).map((item: any) => (
                  <div key={item.id} className="flow-branch flow-branch-nested">
                    <div className="flow-branch-title">Case</div>
                    {renderFlowList(
                      Array.isArray(item.processors) ? item.processors : [],
                      { kind: 'switch', id: node.id, branch: 'case', caseId: item.id },
                      setNodes,
                      scope,
                      lane,
                    )}
                  </div>
                ))}
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Default</div>
                {renderFlowList(
                  Array.isArray(node.config?.defaultProcessors)
                    ? node.config.defaultProcessors
                    : [],
                  { kind: 'switch', id: node.id, branch: 'default' },
                  setNodes,
                  scope,
                  lane,
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const applyProcessor = () => {
    if (!builderTarget) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj || !selectedFile) {
      return;
    }
    const processor = buildProcessorPayload();
    if (!processor) {
      return;
    }
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }
    const existingOverrides = Array.isArray(overrideInfo?.overrides) ? [...overrideInfo.overrides] : [];
    const method = overrideInfo?.method || (String(selectedFile.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
    const scope = 'post';
    const matchIndex = existingOverrides.findIndex((entry: any) => (
      entry?.['@objectName'] === objectName && entry?.method === method && entry?.scope === scope
    ));
    const overrideEntry = matchIndex >= 0
      ? { ...existingOverrides[matchIndex] }
      : {
        name: `${objectName} Override`,
        description: `Overrides for ${objectName}`,
        domain: 'fault',
        method,
        scope,
        '@objectName': objectName,
        _type: 'override',
        processors: [],
      };
    const processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];
    const processorKey = Object.keys(processor)[0];
    const targetField = getProcessorTargetField(processor);
    const existingIdx = processors.findIndex((proc: any) => (
      Object.keys(proc || {})[0] === processorKey && getProcessorTargetField(proc) === targetField
    ));
    if (existingIdx >= 0) {
      const existingProcessor = processors[existingIdx];
      if (JSON.stringify(existingProcessor) === JSON.stringify(processor)) {
        closeBuilder();
        return;
      }
      processors[existingIdx] = processor;
    } else {
      processors.push(processor);
    }
    overrideEntry.processors = processors;
    if (matchIndex >= 0) {
      existingOverrides[matchIndex] = overrideEntry;
    } else {
      existingOverrides.push(overrideEntry);
    }
    setPendingOverrideSave(existingOverrides);
    setCommitMessage('');
    setShowCommitModal(true);
    setProcessorStep('review');
    closeBuilder();
  };

  const processorHelp: Record<string, { title: string; description: string; example: string }> = {
    append: {
      title: 'Append',
      description: 'Append a value to an array or concatenate text into a target field (planned).',
      example: '{"append": {"source": "Example Value", "array": [], "targetField": "$.event.NewArray"}}',
    },
    appendToOutputStream: {
      title: 'Append to Output Stream',
      description: 'Append data to a configured output stream (planned).',
      example: '{"appendToOutputStream": {"source": "$.trap", "output": "pulsar+ssl:///assure1/event/sink"}}',
    },
    break: {
      title: 'Break',
      description: 'Stop processing the current processor chain (planned).',
      example: '{"break": {}}',
    },
    convert: {
      title: 'Convert',
      description: 'Convert a value from one type/format to another (planned).',
      example: '{"convert": {"source": "$.event.Count", "type": "inttostring", "targetField": "$.event.CountString", "ignoreFailure": true}}',
    },
    copy: {
      title: 'Copy',
      description: 'Copy a value from one field to another (planned).',
      example: '{"copy": {"source": "$.event.Count", "targetField": "$.event.CopiedCount"}}',
    },
    discard: {
      title: 'Discard',
      description: 'Discard the event or processing result (planned).',
      example: '{"discard": {}}',
    },
    eval: {
      title: 'Eval',
      description: 'Evaluate a JavaScript expression and store the result (planned).',
      example: '{"eval": {"source": "<expression>", "targetField": "$.localmem.evalResult"}}',
    },
    foreach: {
      title: 'Foreach',
      description: 'Iterate over an array/object and run processors for each item (planned).',
      example: '{"foreach": {"source": "$.event.Details.trap.variables", "keyVal": "i", "valField": "v", "processors": []}}',
    },
    grok: {
      title: 'Grok',
      description: 'Parse text using Grok patterns and store extracted values (planned).',
      example: '{"grok": {"source": "$.syslog.datagram", "pattern": "%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}", "targetField": "$.syslog.variables"}}',
    },
    if: {
      title: 'If',
      description: 'Conditionally run processors based on a single condition (planned).',
      example: '{"if": {"source": "$.event.EventCategory", "operator": "==", "value": 3, "processors": [], "else": []}}',
    },
    json: {
      title: 'JSON',
      description: 'Parse a JSON string and store the result (planned).',
      example: '{"json": {"source": "{\"key\":\"value\"}", "targetField": "$.localmem.json"}}',
    },
    log: {
      title: 'Log',
      description: 'Write a message to the processor log (planned).',
      example: '{"log": {"type": "info", "source": "Log message"}}',
    },
    lookup: {
      title: 'Lookup',
      description: 'Lookup data from a source and store it in a target field (planned).',
      example: '{"lookup": {"source": "db", "properties": {}, "fallback": {}, "targetField": "$.localmem.results"}}',
    },
    math: {
      title: 'Math',
      description: 'Apply arithmetic to a numeric source and store the result (planned).',
      example: '{"math": {"source": "$.event.Count", "operation": "*", "value": 2, "targetField": "$.localmem.CountTimesTwo"}}',
    },
    regex: {
      title: 'Regex',
      description: 'Extract a value from text using a regular expression capture group and store it in a target field.',
      example: '{"regex": {"source": "Events are cleared", "pattern": "Events are (?<text>.*$)", "targetField": ""}}',
    },
    remove: {
      title: 'Remove',
      description: 'Remove a field from the payload (planned).',
      example: '{"remove": {"source": "$.trap.timeTicks"}}',
    },
    rename: {
      title: 'Rename',
      description: 'Rename or move a field to a new target (planned).',
      example: '{"rename": {"source": "$.event.Details", "targetField": "$.event.DetailsOld"}}',
    },
    replace: {
      title: 'Replace',
      description: 'Replace text in a source string (planned).',
      example: '{"replace": {"source": "This is a test", "pattern": "a test", "replacement": "not a test", "targetField": "$.localmem.example"}}',
    },
    set: {
      title: 'Set',
      description: 'Set a target field to a literal value or another field path. Useful for overrides or copying values.',
      example: '{"set": {"source": "$.event.%s", "args": ["Details"], "targetField": "$.event.Details2"}}',
    },
    setOutputStream: {
      title: 'Set Output Stream',
      description: 'Change the output stream for the event (planned).',
      example: '{"setOutputStream": {"output": "pulsar+ssl:///assure1/event/sink"}}',
    },
    sort: {
      title: 'Sort',
      description: 'Sort an array or list and store it (planned).',
      example: '{"sort": {"source": "$.trap.variables", "targetField": "$.trap.sortedVariables"}}',
    },
    split: {
      title: 'Split',
      description: 'Split a string using a delimiter (planned).',
      example: '{"split": {"source": "1,2,3,4", "delimiter": ",", "targetField": "$.localmem.splitarr"}}',
    },
    strcase: {
      title: 'String Case',
      description: 'Change the case of a string (planned).',
      example: '{"strcase": {"source": "HELLO, WORLD", "type": "lower", "targetField": "$.localmem.lowercase"}}',
    },
    substr: {
      title: 'Substring',
      description: 'Extract a substring from a source value (planned).',
      example: '{"substr": {"source": "Hello", "start": 1, "targetField": "$.localmem.substr"}}',
    },
    switch: {
      title: 'Switch',
      description: 'Branch processors based on matching cases (planned).',
      example: '{"switch": {"source": "$.localmem.val1", "operator": "!=", "case": [{"match": 2, "then": [{"discard": {}}]}, {"match": 5, "operator": "==", "then": [{"discard": {}}]}], "default": [{"log": {"type": "info", "source": "Do nothing since none of the cases were met"}}]}}',
    },
    trim: {
      title: 'Trim',
      description: 'Trim characters from a source string (planned).',
      example: '{"trim": {"source": "Hello", "cutset": "H", "targetField": "$.localmem.trim"}}',
    },
  };

  const renderProcessorHelp = (key: keyof typeof processorHelp) => {
    const help = processorHelp[key];
    return (
      <span
        className="processor-help"
        tabIndex={0}
        role="button"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setProcessorTooltip({
            title: help.title,
            description: help.description,
            example: help.example,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8,
          });
        }}
        onMouseLeave={() => setProcessorTooltip(null)}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setProcessorTooltip({
            title: help.title,
            description: help.description,
            example: help.example,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8,
          });
        }}
        onBlur={() => setProcessorTooltip(null)}
      >
        <span className="processor-help-icon">?</span>
      </span>
    );
  };

  const applyBuilderTemplate = (template: string) => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    setBuilderRegularText(template);
  };

  const handleBuilderSelect = (item: ProcessorCatalogItem, isEnabled: boolean) => {
    if (!isEnabled) {
      return;
    }
    if (item.id === 'if') {
      setAdvancedProcessorScope('object');
      setShowAdvancedProcessorModal(true);
      return;
    }
    if (item.id === 'set') {
      setProcessorType('set');
      setProcessorStep('configure');
      setProcessorDraft((prev) => ({
        ...prev,
        sourceType: 'literal',
        source: '',
        pattern: '',
        targetField: builderTarget
          ? `$.event.${builderTarget.field}`
          : prev.targetField,
      }));
      return;
    }
    if (item.id === 'regex') {
      setProcessorType('regex');
      setProcessorStep('configure');
      setProcessorDraft((prev) => ({
        ...prev,
        sourceType: 'path',
        source: '$.event.Summary',
        pattern: '',
        targetField: builderTarget
          ? `$.event.${builderTarget.field}`
          : prev.targetField,
      }));
      return;
    }
    setProcessorType(item.id);
    setProcessorStep('configure');
  };

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    const compiled = buildFriendlyEval();
    if (!compiled) {
      return;
    }
    if (builderSyncRef.current === 'regular') {
      builderSyncRef.current = null;
      return;
    }
    if (compiled.trim() === builderRegularText.trim()) {
      return;
    }
    builderSyncRef.current = 'friendly';
    setBuilderRegularText(compiled);
  }, [builderConditions, builderElseResult]);

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    const text = builderRegularText.trim();
    if (!text) {
      return;
    }
    if (builderSyncRef.current === 'friendly') {
      builderSyncRef.current = null;
      return;
    }
    const parsed = parseEvalToRows(text);
    if (!parsed) {
      return;
    }
    builderSyncRef.current = 'regular';
    setBuilderConditions(parsed.rows);
    setBuilderElseResult(parsed.elseResult);
  }, [builderRegularText]);

  const updateConditionNode = (
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

  const updateBuilderCondition = (
    rowId: string,
    nodeId: string,
    key: 'left' | 'operator' | 'right',
    value: string,
  ) => {
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'condition'
              ? { ...current, [key]: value }
              : current
          )),
        }
        : row
    )));
  };

  const updateConditionGroupOperator = (rowId: string, nodeId: string, operator: 'AND' | 'OR') => {
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'group' ? { ...current, operator } : current
          )),
        }
        : row
    )));
  };

  const addConditionChild = (rowId: string, nodeId: string, type: 'condition' | 'group') => {
    const newChild = type === 'group' ? createGroupNode() : createConditionNode();
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'group'
              ? { ...current, children: [...current.children, newChild] }
              : current
          )),
        }
        : row
    )));
  };

  const removeConditionChild = (rowId: string, nodeId: string) => {
    const removeNode = (node: ConditionTree): ConditionTree | null => {
      if (node.id === nodeId) {
        return null;
      }
      if (node.type === 'group') {
        const nextChildren = node.children
          .map(removeNode)
          .filter((child): child is ConditionTree => Boolean(child));
        if (nextChildren.length === 0) {
          return createConditionNode();
        }
        return { ...node, children: nextChildren };
      }
      return node;
    };
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? { ...row, condition: removeNode(row.condition) as ConditionTree }
        : row
    )));
  };

  const updateBuilderResult = (rowId: string, value: string) => {
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, result: value } : row
    )));
  };

  const addBuilderRow = () => {
    setBuilderConditions((prev) => ([
      ...prev,
      { id: nextBuilderId(), condition: createConditionNode(), result: '' },
    ]));
  };

  const removeBuilderRow = (rowId: string) => {
    setBuilderConditions((prev) => prev.filter((row) => row.id !== rowId));
  };

  const buildConditionExpression = (node: ConditionTree): string => {
    if (node.type === 'condition') {
      const left = node.left.trim();
      const right = node.right.trim();
      if (!left || !node.operator || !right) {
        return '';
      }
      return `${left} ${node.operator} ${right}`;
    }
    const parts = node.children
      .map((child) => buildConditionExpression(child))
      .filter(Boolean);
    if (parts.length !== node.children.length) {
      return '';
    }
    const joiner = node.operator === 'AND' ? ' && ' : ' || ';
    return `(${parts.join(joiner)})`;
  };

  const buildFriendlyEval = () => {
    if (builderConditions.length === 0) {
      return '';
    }
    const elseValue = builderElseResult.trim();
    if (!elseValue) {
      return '';
    }
    let expr = elseValue;
    for (let i = builderConditions.length - 1; i >= 0; i -= 1) {
      const row = builderConditions[i];
      const result = row.result.trim();
      const condition = buildConditionExpression(row.condition);
      if (!condition || !result) {
        return '';
      }
      expr = `(${condition}) ? ${result} : ${expr}`;
    }
    return expr;
  };

  const renderConditionNode = (
    rowId: string,
    node: ConditionTree,
    depth: number,
    isNested: boolean,
    parentCount: number,
  ) => {
    if (node.type === 'condition') {
      return (
        <div className={`builder-condition-line${isNested ? ' builder-condition-line-nested' : ''}`}>
          <input
            className="builder-input"
            value={node.left}
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'left', e.target.value)}
            placeholder="$v1"
            disabled={!isBuilderTargetReady}
            title={node.left}
          />
          <select
            className="builder-select"
            value={node.operator}
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'operator', e.target.value)}
            disabled={!isBuilderTargetReady}
          >
            <option value="==">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value=">=">&gt;=</option>
            <option value="<">&lt;</option>
            <option value="<=">&lt;=</option>
          </select>
          <input
            className="builder-input"
            value={node.right}
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'right', e.target.value)}
            placeholder="1"
            disabled={!isBuilderTargetReady}
            title={node.right}
          />
          {isNested && (
            <button
              type="button"
              className="builder-remove"
              onClick={() => removeConditionChild(rowId, node.id)}
              disabled={!isBuilderTargetReady || parentCount <= 1}
              aria-label="Remove condition"
            >
              ×
            </button>
          )}
        </div>
      );
    }
    return (
      <div className={`builder-group builder-group-depth-${depth}`}>
        <div className="builder-group-header">
          <div className="builder-group-title-row">
            <span className="builder-group-title">Group</span>
            <span className="builder-group-operator-pill">{node.operator}</span>
          </div>
          <div className="builder-mode-toggle">
            <button
              type="button"
              className={node.operator === 'AND'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'}
              onClick={() => updateConditionGroupOperator(rowId, node.id, 'AND')}
              disabled={!isBuilderTargetReady}
            >
              AND
            </button>
            <button
              type="button"
              className={node.operator === 'OR'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'}
              onClick={() => updateConditionGroupOperator(rowId, node.id, 'OR')}
              disabled={!isBuilderTargetReady}
            >
              OR
            </button>
          </div>
          {isNested && (
            <button
              type="button"
              className="builder-remove"
              onClick={() => removeConditionChild(rowId, node.id)}
              disabled={!isBuilderTargetReady || parentCount <= 1}
              aria-label="Remove group"
            >
              ×
            </button>
          )}
        </div>
        <div className="builder-group-children">
          {node.children.map((child) => (
            <div key={child.id} className="builder-group-child">
              {renderConditionNode(rowId, child, depth + 1, true, node.children.length)}
            </div>
          ))}
        </div>
        <div className="builder-group-actions">
          <button
            type="button"
            className="builder-link"
            onClick={() => addConditionChild(rowId, node.id, 'condition')}
            disabled={!isBuilderTargetReady}
          >
            Add condition
          </button>
          <button
            type="button"
            className="builder-link"
            onClick={() => addConditionChild(rowId, node.id, 'group')}
            disabled={!isBuilderTargetReady}
          >
            Add group
          </button>
        </div>
      </div>
    );
  };

  const applyFriendlyEval = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const compiled = buildFriendlyEval();
    if (!compiled) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(compiled)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, compiled);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
    closeBuilder();
  };

  const applyRegularEval = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const text = builderRegularText.trim();
    if (!text) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(text)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, text);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
    closeBuilder();
  };

  const applyLiteralValue = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(builderLiteralText)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, builderLiteralText);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, false);
    closeBuilder();
  };

  const clearRegularEval = () => {
    setBuilderRegularText('');
  };

  const enableEvalForTarget = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
  };

  const renderVarToken = (token: string, trapVars?: any[]) => {
    const index = Number(token.replace('$v', '')) - 1;
    const variable = Array.isArray(trapVars) ? trapVars[index] : null;
    const description = Array.isArray(variable?.description)
      ? variable.description.filter(Boolean).join(' ')
      : renderValue(variable?.description);
    return (
      <span className="override-summary var-token-wrap" tabIndex={0}>
        <button
          type="button"
          className="var-token"
          onClick={() => {
            setVarModalToken(token);
            setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
            setVarModalMode('view');
            setVarInsertContext(null);
            setVarModalOpen(true);
          }}
        >
          {token}
        </button>
        {variable && (
          <div className="override-summary-card" role="tooltip">
            <div className="override-summary-title">Variable {token}</div>
            <ul className="override-summary-list">
              <li className="override-summary-item">
                <span className="override-summary-field">Name</span>
                <span className="override-summary-value">{renderValue(variable?.name)}</span>
              </li>
              <li className="override-summary-item">
                <span className="override-summary-field">OID</span>
                <span className="override-summary-value">{renderValue(variable?.oid)}</span>
              </li>
              {description && description !== '—' && (
                <li className="override-summary-item">
                  <span className="override-summary-field">Description</span>
                  <span className="override-summary-value">{description}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </span>
    );
  };

  const openVarInsertModal = (panelKey: string, field: string, currentValue: string, replaceStart?: number, replaceEnd?: number) => {
    const start = replaceStart ?? currentValue.length;
    const end = replaceEnd ?? currentValue.length;
    setVarInsertContext({
      panelKey,
      field,
      value: currentValue,
      replaceStart: start,
      replaceEnd: end,
    });
    setVarModalToken(null);
    setVarModalMode('insert');
    setVarModalVars(Array.isArray(varModalVars) ? varModalVars : []);
    setVarModalOpen(true);
  };

  const renderSummary = (value: any, trapVars: any[]) => {
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return renderEvalDisplay(value.eval, trapVars);
    }
    const text = typeof value === 'string' ? value : '—';
    if (!text || text === '—') {
      return text;
    }
    const isEvalLike = Boolean(splitTernary(unwrapOuterParens(text.trim())));
    if (isEvalLike) {
      return renderEvalDisplay(text, trapVars);
    }
    const parts = text.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part: string, index: number) => {
          if (!part.match(/^\$v\d+$/)) {
            return <span key={`text-${index}`}>{renderHighlightedText(part)}</span>;
          }
          return (
            <span key={`var-${index}`}>
              {renderVarToken(part, trapVars)}
            </span>
          );
        })}
      </span>
    );
  };

  const renderEvalLineWithVars = (line: string, trapVars?: any[]) => {
    const parts = line.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part: string, index: number) => {
          if (!part.match(/^\$v\d+$/)) {
            return <span key={`line-text-${index}`}>{renderHighlightedText(part)}</span>;
          }
          return (
            <span key={`line-var-${index}`}>
              {renderVarToken(part, trapVars)}
            </span>
          );
        })}
      </span>
    );
  };

  useEffect(() => {
    if (!varModalOpen || !varModalToken) {
      return;
    }
    scrollToRef(varRowRefs.current[varModalToken]);
  }, [varModalOpen, varModalToken, varModalVars]);

  useEffect(() => {
    if (!highlightQuery || !selectedFile || !searchHighlightActive) {
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      return;
    }
    const query = highlightQuery.toLowerCase();
    const objects = getFriendlyObjects(fileData);
    const matches: string[] = [];
    objects.forEach((obj: any, idx: number) => {
      try {
        const text = JSON.stringify(obj).toLowerCase();
        if (text.includes(query)) {
          matches.push(getObjectKey(obj, idx));
        }
      } catch {
        // ignore
      }
    });
    setHighlightObjectKeys(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : 0);
  }, [fileData, highlightQuery, highlightPathId, selectedFile]);

  useEffect(() => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    scrollToMatchIndex(currentMatchIndex);
  }, [currentMatchIndex, highlightObjectKeys]);

  useEffect(() => {
    if (!selectedFile) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setSearchHighlightActive(false);
      return;
    }
  }, [selectedFile, highlightPathId]);

  const formatDescription = (value: any) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(' ');
    }
    return renderValue(value);
  };

  const renderEnums = (enums: any) => {
    if (!enums || typeof enums !== 'object') {
      return null;
    }
    const entries = Object.entries(enums);
    if (entries.length === 0) {
      return null;
    }
    return (
      <details className="trap-var-enums">
        <summary>Enums ({entries.length})</summary>
        <ul>
          {entries.map(([key, value]) => (
            <li key={key}>
              <span className="enum-key">{key}</span>
              <span className="enum-value">{renderValue(value)}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  };

  const renderTrapVariables = (variables: any) => {
    if (!Array.isArray(variables) || variables.length === 0) {
      return '—';
    }
    return (
      <details className="trap-vars">
        <summary>{variables.length} variable(s)</summary>
        <div className="trap-vars-list">
          {variables.map((variable: any, index: number) => (
            <div className="trap-var" key={variable?.name || variable?.oid || index}>
              <div className="trap-var-title">
                <span className="trap-var-name">{renderValue(variable?.name)}</span>
                <span className="pill">$v{index + 1}</span>
                {variable?.valueType && <span className="pill">{variable.valueType}</span>}
              </div>
              <div className="trap-var-grid">
                <div className="trap-var-col">
                  <div className="trap-var-row">
                    <span className="label">OID</span>
                    <span className="value monospace">{renderValue(variable?.oid)}</span>
                  </div>
                  <div className="trap-var-row">
                    <span className="label">Description</span>
                    <span className="value">{formatDescription(variable?.description)}</span>
                  </div>
                </div>
                <div className="trap-var-col">
                  {renderEnums(variable?.enums) || (
                    <span className="muted">No enums</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  };

  const handleNextMatch = () => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    setCurrentMatchIndex((prev) => (prev + 1) % highlightObjectKeys.length);
  };

  const handlePrevMatch = () => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    setCurrentMatchIndex((prev) => (prev - 1 + highlightObjectKeys.length) % highlightObjectKeys.length);
  };

  const normalizeEvalText = (value: string) => (
    value
      .replace(/\s+/g, ' ')
      .replace(/&&/g, ' AND ')
      .replace(/\|\|/g, ' OR ')
      .replace(/==/g, ' = ')
      .replace(/!=/g, ' ≠ ')
      .replace(/>=/g, ' ≥ ')
      .replace(/<=/g, ' ≤ ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const unwrapOuterParens = (value: string) => {
    let result = value.trim();
    while (result.startsWith('(') && result.endsWith(')')) {
      let depth = 0;
      let isWrapped = true;
      for (let i = 0; i < result.length; i += 1) {
        const char = result[i];
        if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          depth -= 1;
          if (depth === 0 && i !== result.length - 1) {
            isWrapped = false;
            break;
          }
        }
      }
      if (!isWrapped || depth !== 0) {
        break;
      }
      result = result.slice(1, -1).trim();
    }
    return result;
  };

  const splitTernary = (value: string) => {
    const cleaned = unwrapOuterParens(value);
    let questionIndex = -1;
    let depth = 0;
    let parenDepth = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      }
      if (parenDepth > 0) {
        continue;
      }
      if (char === '?') {
        if (depth === 0) {
          questionIndex = i;
        }
        depth += 1;
      } else if (char === ':') {
        if (depth === 1) {
          const condition = cleaned.slice(0, questionIndex);
          const whenTrue = cleaned.slice(questionIndex + 1, i);
          const whenFalse = cleaned.slice(i + 1);
          return { condition, whenTrue, whenFalse };
        }
        if (depth > 0) {
          depth -= 1;
        }
      }
    }
    return null;
  };

  const formatEvalReadableList = (text: string) => {
    const cleaned = unwrapOuterParens(text.trim());
    const ternary = splitTernary(cleaned);
    if (!ternary) {
      return [`Set to ${normalizeEvalText(cleaned)}`];
    }
    const lines: string[] = [];
    const walk = (expr: string, isFirst: boolean) => {
      const node = splitTernary(unwrapOuterParens(expr.trim()));
      if (!node) {
        lines.push(isFirst ? `Set to ${normalizeEvalText(expr)}` : `Else set to ${normalizeEvalText(expr)}`);
        return;
      }
      const condition = normalizeEvalText(node.condition)
        .replace(/=\s*(\d+)/g, 'is $1')
        .replace(/\bOR\b/g, 'or');
      const thenExpr = normalizeEvalText(node.whenTrue);
      if (isFirst) {
        lines.push(`If ${condition}, set to ${thenExpr}`);
      } else {
        lines.push(`Else if ${condition}, set to ${thenExpr}`);
      }
      walk(node.whenFalse, false);
    };
    walk(cleaned, true);
    return lines;
  };
  const renderEvalDisplay = (evalText: string, trapVars?: any[]) => {
    try {
      const lines = formatEvalReadableList(evalText);
      return (
        <div className="eval-display">
          <span className="eval-label eval-label-hover override-summary" tabIndex={0}>
            <span className="eval-label-icon">ⓘ</span>
            Eval
            <div className="override-summary-card eval-summary-card" role="tooltip">
              <div className="override-summary-title">Eval (Raw)</div>
              <div className="override-summary-value monospace">{evalText}</div>
            </div>
          </span>
          <div className="eval-demo eval-demo-lines">
            {lines.map((line, index) => (
              <span key={`${line}-${index}`}>{renderEvalLineWithVars(line, trapVars)}</span>
            ))}
          </div>
        </div>
      );
    } catch {
      return <span className="eval-fallback">{renderHighlightedText(evalText)}</span>;
    }
  };

  const friendlyPreview = buildFriendlyEval();
  const literalMeta = getLiteralEligibility();
  const literalDirty = builderTarget
    ? (() => {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      if (!obj) {
        return false;
      }
      return getCurrentFieldValue(
        obj,
        builderTarget.panelKey,
        builderTarget.field,
      ) !== builderLiteralText;
    })()
    : false;
  const flowEditorJsonErrors = getFlowEditorJsonErrors(flowEditorDraft);
  const flowEditorArgsError = flowEditorJsonErrors.find((item) => item.field === 'args')?.message || '';

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>COM Curation &amp; Management</h1>
          {isAuthenticated && (
            <div className="header-actions">
              <p>Welcome, {session?.user}</p>
              <button type="button" className="search-button logout-button" onClick={handleLogout}>
                <span className="logout-icon" aria-hidden="true">🚪</span>
                Logout
              </button>
            </div>
          )}
        </header>
        <main className="app-main">
        {isAuthenticated ? (
          <div className="split-layout">
            <div className="panel">
              <div className="panel-scroll">
                <div className="panel-header">
                  <div className="panel-title-row">
                    <h2>File Browser</h2>
                    <button
                      type="button"
                      className="info-button"
                      onClick={() => setShowPathModal(true)}
                      aria-label="Show full path"
                      title="Show full path"
                    >
                      ?
                    </button>
                  </div>
                  {!canEditRules && (
                    <div className="panel-flag-row">
                      <span className="read-only-flag" title="You do not have permission to edit rules.">
                        Read-only access
                      </span>
                    </div>
                  )}
                  <div className="breadcrumbs">
                    {breadcrumbs.map((crumb, index) => (
                      <button
                        key={`${crumb.label}-${index}`}
                        type="button"
                        className="crumb"
                        onClick={() => handleCrumbClick(index)}
                        disabled={index === breadcrumbs.length - 1}
                      >
                        {crumb.label}
                      </button>
                    ))}
                  </div>
                  <div className="panel-section">
                    <div className="panel-section-title">Search</div>
                    <form className="global-search" onSubmit={handleSearchSubmit}>
                      <div className="global-search-row">
                        <input
                          type="text"
                          placeholder="Search files and contents"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <select
                          value={searchScope}
                          onChange={(e) => setSearchScope(e.target.value as 'all' | 'name' | 'content')}
                        >
                          <option value="all">All</option>
                          <option value="name">Names</option>
                          <option value="content">Content</option>
                        </select>
                        <button type="submit" className="search-button" disabled={searchLoading}>
                          {searchLoading ? 'Searching…' : 'Search'}
                        </button>
                      </div>
                      <div className="search-actions-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={handleClearSearch}
                          disabled={!searchQuery && searchResults.length === 0}
                        >
                          Clear Search
                        </button>
                        <button type="button" className="ghost-button" onClick={handleResetNavigation}>
                          Reset Navigation
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="panel-section">
                    <div className="panel-section-title">Favorites</div>
                    <div className="favorites-section">
                    <div className="favorites-scroll">
                      <details open={favoritesFolders.length > 0}>
                        <summary>Favorite Folders</summary>
                        {favoritesLoading && <div className="muted">Loading…</div>}
                        {favoritesError && <div className="error">{favoritesError}</div>}
                        {favoritesFolders.length === 0 ? (
                          <div className="empty-state">No favorites yet.</div>
                        ) : (
                          <ul className="favorites-list">
                            {favoritesFolders.map((fav) => (
                              <li key={`${fav.type}-${fav.pathId}`}>
                                <button
                                  type="button"
                                  className="quick-link"
                                  onClick={() => handleOpenFolder({ PathID: fav.pathId, PathName: fav.label })}
                                >
                                  {fav.label}
                                  {getParentLabel(getParentPath(fav.pathId)) && (
                                    <span className="favorite-parent"> - ({getParentLabel(getParentPath(fav.pathId))})</span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                      <details open={favoritesFiles.length > 0}>
                        <summary>Favorite Files</summary>
                        {favoritesFiles.length === 0 ? (
                          <div className="empty-state">No favorites yet.</div>
                        ) : (
                          <ul className="favorites-list">
                            {favoritesFiles.map((fav) => (
                              <li key={`${fav.type}-${fav.pathId}`}>
                                <button
                                  type="button"
                                  className="quick-link"
                                  onClick={() => openFileFromUrl(fav.pathId, fav.node)}
                                >
                                  {fav.label}
                                  {fav.node && (
                                    <span className="favorite-parent"> - ({getParentLabel(fav.node)})</span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </div>
                    </div>
                  </div>
                </div>
                {searchQuery.trim() && (
                  <div className="search-results">
                    <div className="search-results-header">
                      <span>Search results ({searchResults.length})</span>
                      {searchLoading && <span className="muted">Searching…</span>}
                    </div>
                    {searchError && <div className="error">{searchError}</div>}
                    {!searchLoading && !searchError && searchResults.length === 0 && (
                      <div className="empty-state">No matches found.</div>
                    )}
                    {searchResults.length > 0 && (
                      <ul className="search-results-list">
                        {searchResults.map((result: any) => (
                          <li key={`${result.pathId}-${result.source}`}>
                            <button
                              type="button"
                              className="search-result-link"
                              onClick={() => {
                                highlightNextOpenRef.current = true;
                                setHighlightQuery(searchQuery.trim());
                                setHighlightPathId(result.pathId);
                                setSearchHighlightActive(true);
                                if (result.type === 'folder') {
                                  void handleOpenFolder({
                                    PathID: result.pathId,
                                    PathName: getSearchResultName(result),
                                  });
                                } else {
                                  void openFileFromUrl(result.pathId);
                                }
                              }}
                            >
                              <span className="search-icon" aria-hidden="true">
                                {result.type === 'folder' ? '📁' : '📄'}
                              </span>
                              {getSearchResultName(result)}
                            </button>
                            <div className="search-result-meta">
                              <span className="search-result-path">{formatDisplayPath(result.pathId)}</span>
                              {result.matchCount && (
                                <span className="pill">{result.matchCount} hit{result.matchCount > 1 ? 's' : ''}</span>
                              )}
                              <span className="pill">{result.source}</span>
                            </div>
                            {result.matches?.length > 0 && (
                              <div className="search-snippet">
                                <span className="muted">L{result.matches[0].line}:</span> {result.matches[0].preview}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {browseError && <div className="error">{browseError}</div>}
                {browseData && (
                  <div className="browse-results">
                    {entries.length > 0 ? (
                      <ul className="browse-list">
                        {entries.map((entry: any) => (
                          <li key={entry.PathID || entry.PathName}>
                            {isFolder(entry) ? (
                              <button
                                type="button"
                                className="browse-link"
                                onClick={() => handleOpenFolder(entry)}
                              >
                                <span className="browse-icon" aria-hidden="true">📁</span>
                                {entry.PathName}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="browse-link file-link"
                                onClick={() => handleOpenFile(entry)}
                              >
                                <span className="browse-icon" aria-hidden="true">📄</span>
                                {entry.PathName}
                              </button>
                            )}
                            <span className="browse-meta">
                              {entry.Info || ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <pre>{JSON.stringify(browseData, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <h2>File Details</h2>
              </div>
              {!selectedFile && !selectedFolder ? (
                <div className="empty-state">Select a file to preview.</div>
              ) : selectedFolder && !selectedFile ? (
                <div className="file-details">
                  <div className="file-title">
                    <strong>
                      {selectedFolder.PathName}
                      <button
                        type="button"
                        className={`star-button ${isFavorite(selectedFolder.PathID, 'folder') ? 'star-active' : ''}`}
                        onClick={() => toggleFavorite({
                          type: 'folder',
                          pathId: selectedFolder.PathID,
                          label: selectedFolder.PathName,
                          node: selectedFolder.PathID,
                        })}
                        aria-label="Toggle favorite folder"
                        title="Toggle favorite folder"
                      >
                        ★
                      </button>
                    </strong>
                  </div>
                  {folderLoading ? (
                    <div>Loading folder overview…</div>
                  ) : folderOverview ? (
                    <div className="folder-overview">
                      {folderOverview.fileCount > 0 ? (
                        <>
                          <div className="folder-summary">
                            <div>
                              <span className="label">Files</span>
                              <span className="value">{folderOverview.fileCount}</span>
                            </div>
                            <div>
                              <span className="label">Objects</span>
                              <span className="value">{folderOverview.objectCount}</span>
                            </div>
                            <div>
                              <span className="label">Schema Errors</span>
                              <span className="value">{folderOverview.schemaErrorCount}</span>
                            </div>
                            <div>
                              <span className="label">Unknown Fields</span>
                              <span className="value">{folderOverview.unknownFieldCount}</span>
                            </div>
                          </div>
                          <div className="folder-table">
                            <div className="folder-table-header">
                              <span>File</span>
                              <span>Schema Errors</span>
                              <span>Unknown Fields</span>
                            </div>
                            {folderOverview.topFiles?.length ? (
                              folderOverview.topFiles.map((row: any) => (
                                <div className="folder-table-row" key={row.pathId}>
                                  <button
                                    type="button"
                                    className="folder-link"
                                    onClick={() => openFileFromUrl(row.pathId)}
                                  >
                                    {row.file}
                                  </button>
                                  <span>{row.schemaErrors}</span>
                                  <span>{row.unknownFields}</span>
                                </div>
                              ))
                            ) : (
                              <div className="empty-state">No files with issues.</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="empty-state">No JSON files in this folder.</div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">No overview available.</div>
                  )}
                </div>
              ) : (
                <div className="file-details">
                  <div className="file-title">
                    <strong>
                      {selectedFile.PathName}
                      <button
                        type="button"
                        className={`star-button ${isFavorite(selectedFile.PathID, 'file') ? 'star-active' : ''}`}
                        onClick={() => toggleFavorite({
                          type: 'file',
                          pathId: selectedFile.PathID,
                          label: selectedFile.PathName,
                          node: browseNode || undefined,
                        })}
                        aria-label="Toggle favorite file"
                        title="Toggle favorite file"
                      >
                        ★
                      </button>
                    </strong>
                  </div>
                  <div className="file-meta-row">
                    <span className="schema-status">
                      {schemaLoading && <span>Schema: Loading…</span>}
                      {schemaError && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: Error
                        </button>
                      )}
                      {!schemaLoading && !schemaError && !validator && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: Not available
                        </button>
                      )}
                      {!schemaLoading && !schemaError && validator && !jsonParseError && validationErrors.length === 0 && (
                        <span className="schema-valid" aria-label="Schema validated">
                          Schema: ✓
                        </span>
                      )}
                      {!schemaLoading && !schemaError && validator && (jsonParseError || validationErrors.length > 0) && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: {jsonParseError ? 'JSON error' : `${validationErrors.length} issue(s)`}
                        </button>
                      )}
                    </span>
                  </div>
                  {overrideInfo?.overrideMeta?.pathName
                    && Array.isArray(overrideInfo?.overrides)
                    && overrideInfo.overrides.length > 0 && (
                    <div className="override-meta-row">
                      <span>
                        Override file: {overrideInfo?.overrideMeta?.pathName || overrideInfo?.overrideFileName || '—'}
                      </span>
                      <span>
                        Revision:{' '}
                        {overrideInfo?.overrideMeta?.revision && /^[0-9]+$/.test(String(overrideInfo.overrideMeta.revision))
                          ? `r${overrideInfo.overrideMeta.revision}`
                          : overrideInfo?.overrideMeta?.revision || '—'}
                      </span>
                      <span>Modified: {overrideInfo?.overrideMeta?.modified || '—'}</span>
                      <span>Modified by: {overrideInfo?.overrideMeta?.modifiedBy || '—'}</span>
                    </div>
                  )}
                  <div className="action-row">
                    <div className="view-toggle">
                      <span className={viewMode === 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                        Friendly
                      </span>
                      <label className="switch" aria-label="Toggle friendly/raw view">
                        <input
                          type="checkbox"
                          checked={viewMode !== 'friendly'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setViewMode('preview');
                            } else {
                              setViewMode('friendly');
                            }
                          }}
                        />
                        <span className="slider" />
                      </label>
                      <span className={viewMode !== 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                        Raw
                      </span>
                    </div>
                    <button
                      type="button"
                      className="action-link"
                      onClick={() => {
                        setAdvancedProcessorScope('global');
                        setShowAdvancedProcessorModal(true);
                      }}
                    >
                      Advanced Processors (Global)
                    </button>
                  </div>
                  {fileError && <div className="error">{fileError}</div>}
                  {saveError && <div className="error">{saveError}</div>}
                  {saveSuccess && <div className="success">{saveSuccess}</div>}
                  <div className="file-preview">
                    {fileLoading ? (
                      <div>Loading preview…</div>
                    ) : (
                      viewMode === 'friendly' ? (
                        <div className={isAnyPanelEditing ? 'friendly-layout' : 'friendly-view'}>
                          <div className={isAnyPanelEditing ? 'friendly-main' : ''}>
                          {searchHighlightActive && highlightObjectKeys.length > 0 && (
                            <div className="match-bar">
                              <span className="match-label">
                                Match {currentMatchIndex + 1} of {highlightObjectKeys.length}
                              </span>
                              <div className="match-actions">
                                <button type="button" className="match-button" onClick={handlePrevMatch}>
                                  Prev
                                </button>
                                <button type="button" className="match-button" onClick={handleNextMatch}>
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                          {getFriendlyObjects(fileData).length === 0 ? (
                            <div className="empty-state">No objects found.</div>
                          ) : (
                            getFriendlyObjects(fileData).map((obj: any, idx: number) => {
                              const overrideFlags = getOverrideFlags(obj);
                              const overrideTargets = getOverrideTargets(obj);
                              const overrideValueMap = getOverrideValueMap(obj);
                              const objectKey = getObjectKey(obj, idx);
                              const eventPanelKey = `${objectKey}:event`;
                              const eventOverrideFields = getEventOverrideFields(obj);
                              const baseFields = getBaseEventFields(obj, eventPanelKey);
                              return (
                              <div
                                className={`object-card${highlightObjectKeys.includes(getObjectKey(obj, idx))
                                  ? ' object-card-highlight'
                                  : ''}${searchHighlightActive && highlightObjectKeys.length > 0 &&
                                    !highlightObjectKeys.includes(getObjectKey(obj, idx))
                                    ? ' object-card-dim'
                                    : ''}`}
                                key={obj?.['@objectName'] || idx}
                                ref={(el) => {
                                  objectRowRefs.current[objectKey] = el;
                                }}
                              >
                                <div className="object-header">
                                  <div className="object-title">
                                    <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
                                    {obj?.certification && <span className="pill">{obj.certification}</span>}
                                    {overrideFlags.any && <span className="pill override-pill">Override</span>}
                                    {overrideFlags.advancedFlow && (
                                      <span className="pill" title="Advanced Flow configured for this object">
                                        Advanced Flow
                                      </span>
                                    )}
                                    {highlightObjectKeys.includes(getObjectKey(obj, idx)) && (
                                      <span className="pill match-pill">Match</span>
                                    )}
                                  </div>
                                  {obj?.description && <div className="object-description">{obj.description}</div>}
                                </div>
                                <div
                                  className={`object-panel${panelEditState[eventPanelKey]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <div className="panel-title-group">
                                      <span className="object-panel-title">Event</span>
                                      {eventOverrideFields.length > 0 && (
                                        <div className="override-summary" tabIndex={0}>
                                          <span className="pill override-pill">Override</span>
                                          {renderOverrideSummaryCard(
                                            obj,
                                            overrideValueMap,
                                            eventOverrideFields,
                                            `Overrides (${eventOverrideFields.length})`,
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {canEditRules && !panelEditState[eventPanelKey] && (
                                      <button
                                        type="button"
                                        className="panel-edit-button"
                                        onClick={() => startEventEdit(obj, eventPanelKey)}
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {canEditRules && panelEditState[eventPanelKey] && (
                                      <div className="panel-edit-actions">
                                        {eventOverrideFields.length > 1 && (
                                          <button
                                            type="button"
                                            className="override-remove-all-button"
                                            onClick={() => openRemoveAllOverridesModal(obj, eventPanelKey)}
                                          >
                                            Remove All Overrides
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="panel-edit-button"
                                          onClick={() => openAddFieldModal(eventPanelKey, obj)}
                                          disabled={builderTarget?.panelKey === eventPanelKey}
                                          title={builderTarget?.panelKey === eventPanelKey
                                            ? 'Finish or cancel the builder to add fields'
                                            : ''}
                                        >
                                          Add Field
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-edit-button"
                                          onClick={() => saveEventEdit(obj, eventPanelKey)}
                                          disabled={getPanelDirtyFields(obj, eventPanelKey).length === 0}
                                          title={getPanelDirtyFields(obj, eventPanelKey).length === 0
                                            ? 'No changes to save'
                                            : ''}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-edit-button"
                                          onClick={() => cancelEventEdit(eventPanelKey)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="object-grid">
                                    <div className="object-row object-row-primary">
                                      {baseFields.includes('Node') && (
                                        <div>
                                          <span className="label">Node</span>
                                          <span className="value">{renderValue(obj?.event?.Node, obj?.trap?.variables)}</span>
                                        </div>
                                      )}
                                      {baseFields.includes('Summary') && (
                                        <div>
                                          <span className={isFieldHighlighted(eventPanelKey, 'Summary')
                                            ? 'label label-warning'
                                            : 'label'}>
                                            Summary
                                            {renderFieldBadges(eventPanelKey, 'Summary', obj, overrideTargets)}
                                            {panelEditState[eventPanelKey] && (
                                              <span className="label-actions">
                                                <button
                                                  type="button"
                                                  className="builder-link"
                                                  onClick={() => openBuilderForField(obj, eventPanelKey, 'Summary')}
                                                  disabled={isFieldLockedByBuilder(eventPanelKey, 'Summary')}
                                                >
                                                  Builder
                                                </button>
                                              </span>
                                            )}
                                            {overrideTargets.has('$.event.Summary') && (
                                              <div className="override-summary" tabIndex={0}>
                                                <span
                                                  className="pill override-pill pill-inline pill-action"
                                                  title={`Original: ${getBaseEventDisplay(obj, 'Summary')}`}
                                                >
                                                  Override
                                                  {canEditRules && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.Summary') && (
                                                    <button
                                                      type="button"
                                                      className="pill-close"
                                                      aria-label="Remove Summary override"
                                                      onClick={() => openRemoveOverrideModal(obj, 'Summary', eventPanelKey)}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                                {renderOverrideSummaryCard(
                                                  obj,
                                                  overrideValueMap,
                                                  ['Summary'],
                                                  'Override',
                                                )}
                                              </div>
                                            )}
                                            {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'Summary') && (
                                              <span className="dirty-indicator" title="Unsaved change">✎</span>
                                            )}
                                          </span>
                                          {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                            (() => {
                                              const value = getEffectiveEventValue(obj, 'Summary');
                                              const editable = getEditableValue(value);
                                              return (
                                                <input
                                                  className={isFieldHighlighted(eventPanelKey, 'Summary')
                                                    ? 'panel-input panel-input-warning'
                                                    : 'panel-input'}
                                                  value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.Summary ?? ''}
                                                  onChange={(e) => handleEventInputChange(
                                                    obj,
                                                    eventPanelKey,
                                                    'Summary',
                                                    e.target.value,
                                                    e.target.selectionStart,
                                                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                  )}
                                                  disabled={!editable.editable || isFieldLockedByBuilder(eventPanelKey, 'Summary')}
                                                  title={
                                                    !editable.editable
                                                      ? 'Eval values cannot be edited yet'
                                                      : isFieldLockedByBuilder(eventPanelKey, 'Summary')
                                                        ? 'Finish or cancel the builder to edit other fields'
                                                        : ''
                                                  }
                                                />
                                              );
                                            })()
                                          ) : (
                                            <span className="value">
                                              {renderSummary(
                                                overrideValueMap.get('$.event.Summary') ?? obj?.event?.Summary,
                                                obj?.trap?.variables,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {baseFields.includes('Severity') && (
                                        <div>
                                          <span className={isFieldHighlighted(eventPanelKey, 'Severity')
                                            ? 'label label-warning'
                                            : 'label'}>
                                            Severity
                                            {renderFieldBadges(eventPanelKey, 'Severity', obj, overrideTargets)}
                                            {panelEditState[eventPanelKey] && (
                                              <span className="label-actions">
                                                <button
                                                  type="button"
                                                  className="builder-link"
                                                  onClick={() => openBuilderForField(obj, eventPanelKey, 'Severity')}
                                                  disabled={isFieldLockedByBuilder(eventPanelKey, 'Severity')}
                                                >
                                                  Builder
                                                </button>
                                              </span>
                                            )}
                                            {overrideTargets.has('$.event.Severity') && (
                                              <div className="override-summary" tabIndex={0}>
                                                <span
                                                  className="pill override-pill pill-inline pill-action"
                                                  title={`Original: ${getBaseEventDisplay(obj, 'Severity')}`}
                                                >
                                                  Override
                                                  {canEditRules && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.Severity') && (
                                                    <button
                                                      type="button"
                                                      className="pill-close"
                                                      aria-label="Remove Severity override"
                                                      onClick={() => openRemoveOverrideModal(obj, 'Severity', eventPanelKey)}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                                {renderOverrideSummaryCard(
                                                  obj,
                                                  overrideValueMap,
                                                  ['Severity'],
                                                  'Override',
                                                )}
                                              </div>
                                            )}
                                            {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'Severity') && (
                                              <span className="dirty-indicator" title="Unsaved change">✎</span>
                                            )}
                                          </span>
                                          {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                            <input
                                              className={isFieldHighlighted(eventPanelKey, 'Severity')
                                                ? 'panel-input panel-input-warning'
                                                : 'panel-input'}
                                              value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.Severity ?? ''}
                                              onChange={(e) => handleEventInputChange(
                                                obj,
                                                eventPanelKey,
                                                'Severity',
                                                e.target.value,
                                                e.target.selectionStart,
                                                (e.nativeEvent as InputEvent | undefined)?.inputType,
                                              )}
                                              disabled={isFieldLockedByBuilder(eventPanelKey, 'Severity')}
                                              title={isFieldLockedByBuilder(eventPanelKey, 'Severity')
                                                ? 'Finish or cancel the builder to edit other fields'
                                                : ''}
                                            />
                                          ) : (
                                            <span className="value">
                                              {renderValue(
                                                overrideValueMap.get('$.event.Severity') ?? obj?.event?.Severity,
                                                obj?.trap?.variables,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="object-row object-row-secondary">
                                      {baseFields.includes('EventType') && (
                                        <div>
                                          <span className={isFieldHighlighted(eventPanelKey, 'EventType')
                                            ? 'label label-warning'
                                            : 'label'}>
                                            Event Type
                                            {renderFieldBadges(eventPanelKey, 'EventType', obj, overrideTargets)}
                                            {panelEditState[eventPanelKey] && (
                                              <span className="label-actions">
                                                <button
                                                  type="button"
                                                  className="builder-link"
                                                  onClick={() => openBuilderForField(obj, eventPanelKey, 'EventType')}
                                                  disabled={isFieldLockedByBuilder(eventPanelKey, 'EventType')}
                                                >
                                                  Builder
                                                </button>
                                              </span>
                                            )}
                                            {overrideTargets.has('$.event.EventType') && (
                                              <div className="override-summary" tabIndex={0}>
                                                <span
                                                  className="pill override-pill pill-inline pill-action"
                                                  title={`Original: ${getBaseEventDisplay(obj, 'EventType')}`}
                                                >
                                                  Override
                                                  {canEditRules && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.EventType') && (
                                                    <button
                                                      type="button"
                                                      className="pill-close"
                                                      aria-label="Remove EventType override"
                                                      onClick={() => openRemoveOverrideModal(obj, 'EventType', eventPanelKey)}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                                {renderOverrideSummaryCard(
                                                  obj,
                                                  overrideValueMap,
                                                  ['EventType'],
                                                  'Override',
                                                )}
                                              </div>
                                            )}
                                            {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'EventType') && (
                                              <span className="dirty-indicator" title="Unsaved change">✎</span>
                                            )}
                                          </span>
                                          {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                            <input
                                              className={isFieldHighlighted(eventPanelKey, 'EventType')
                                                ? 'panel-input panel-input-warning'
                                                : 'panel-input'}
                                              value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.EventType ?? ''}
                                              onChange={(e) => handleEventInputChange(
                                                obj,
                                                eventPanelKey,
                                                'EventType',
                                                e.target.value,
                                                e.target.selectionStart,
                                                (e.nativeEvent as InputEvent | undefined)?.inputType,
                                              )}
                                              disabled={isFieldLockedByBuilder(eventPanelKey, 'EventType')}
                                              title={isFieldLockedByBuilder(eventPanelKey, 'EventType')
                                                ? 'Finish or cancel the builder to edit other fields'
                                                : ''}
                                            />
                                          ) : (
                                            <span className="value">
                                              {renderValue(
                                                overrideValueMap.get('$.event.EventType') ?? obj?.event?.EventType,
                                                obj?.trap?.variables,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {baseFields.includes('ExpireTime') && (
                                        <div>
                                          <span className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                                            ? 'label label-warning'
                                            : 'label'}>
                                            Expire Time
                                            {renderFieldBadges(eventPanelKey, 'ExpireTime', obj, overrideTargets)}
                                            {panelEditState[eventPanelKey] && (
                                              <span className="label-actions">
                                                <button
                                                  type="button"
                                                  className="builder-link"
                                                  onClick={() => openBuilderForField(obj, eventPanelKey, 'ExpireTime')}
                                                  disabled={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')}
                                                >
                                                  Builder
                                                </button>
                                              </span>
                                            )}
                                            {overrideTargets.has('$.event.ExpireTime') && (
                                              <div className="override-summary" tabIndex={0}>
                                                <span
                                                  className="pill override-pill pill-inline pill-action"
                                                  title={`Original: ${getBaseEventDisplay(obj, 'ExpireTime')}`}
                                                >
                                                  Override
                                                  {canEditRules && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.ExpireTime') && (
                                                    <button
                                                      type="button"
                                                      className="pill-close"
                                                      aria-label="Remove ExpireTime override"
                                                      onClick={() => openRemoveOverrideModal(obj, 'ExpireTime', eventPanelKey)}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                                {renderOverrideSummaryCard(
                                                  obj,
                                                  overrideValueMap,
                                                  ['ExpireTime'],
                                                  'Override',
                                                )}
                                              </div>
                                            )}
                                            {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'ExpireTime') && (
                                              <span className="dirty-indicator" title="Unsaved change">✎</span>
                                            )}
                                          </span>
                                          {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                            <input
                                              className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                                                ? 'panel-input panel-input-warning'
                                                : 'panel-input'}
                                              value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.ExpireTime ?? ''}
                                              onChange={(e) => handleEventInputChange(
                                                obj,
                                                eventPanelKey,
                                                'ExpireTime',
                                                e.target.value,
                                                e.target.selectionStart,
                                                (e.nativeEvent as InputEvent | undefined)?.inputType,
                                              )}
                                              disabled={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')}
                                              title={isFieldLockedByBuilder(eventPanelKey, 'ExpireTime')
                                                ? 'Finish or cancel the builder to edit other fields'
                                                : ''}
                                            />
                                          ) : (
                                            <span className="value">
                                              {renderValue(
                                                overrideValueMap.get('$.event.ExpireTime') ?? obj?.event?.ExpireTime,
                                                obj?.trap?.variables,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {baseFields.includes('EventCategory') && (
                                        <div>
                                          <span className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                                            ? 'label label-warning'
                                            : 'label'}>
                                            Event Category
                                            {renderFieldBadges(eventPanelKey, 'EventCategory', obj, overrideTargets)}
                                            {panelEditState[eventPanelKey] && (
                                              <span className="label-actions">
                                                <button
                                                  type="button"
                                                  className="builder-link"
                                                  onClick={() => openBuilderForField(obj, eventPanelKey, 'EventCategory')}
                                                  disabled={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')}
                                                >
                                                  Builder
                                                </button>
                                              </span>
                                            )}
                                            {overrideTargets.has('$.event.EventCategory') && (
                                              <div className="override-summary" tabIndex={0}>
                                                <span
                                                  className="pill override-pill pill-inline pill-action"
                                                  title={`Original: ${getBaseEventDisplay(obj, 'EventCategory')}`}
                                                >
                                                  Override
                                                  {canEditRules && panelEditState[eventPanelKey] && overrideValueMap.has('$.event.EventCategory') && (
                                                    <button
                                                      type="button"
                                                      className="pill-close"
                                                      aria-label="Remove EventCategory override"
                                                      onClick={() => openRemoveOverrideModal(obj, 'EventCategory', eventPanelKey)}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                                {renderOverrideSummaryCard(
                                                  obj,
                                                  overrideValueMap,
                                                  ['EventCategory'],
                                                  'Override',
                                                )}
                                              </div>
                                            )}
                                            {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, 'EventCategory') && (
                                              <span className="dirty-indicator" title="Unsaved change">✎</span>
                                            )}
                                          </span>
                                          {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                            <input
                                              className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                                                ? 'panel-input panel-input-warning'
                                                : 'panel-input'}
                                              value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.EventCategory ?? ''}
                                              onChange={(e) => handleEventInputChange(
                                                obj,
                                                eventPanelKey,
                                                'EventCategory',
                                                e.target.value,
                                                e.target.selectionStart,
                                                (e.nativeEvent as InputEvent | undefined)?.inputType,
                                              )}
                                              disabled={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')}
                                              title={isFieldLockedByBuilder(eventPanelKey, 'EventCategory')
                                                ? 'Finish or cancel the builder to edit other fields'
                                                : ''}
                                            />
                                          ) : (
                                            <span className="value">
                                              {renderValue(
                                                overrideValueMap.get('$.event.EventCategory') ?? obj?.event?.EventCategory,
                                                obj?.trap?.variables,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div>
                                        <span className="label">OID</span>
                                        <span className="value monospace">{renderValue(obj?.trap?.oid)}</span>
                                      </div>
                                    </div>
                                    {getAdditionalEventFields(obj, eventPanelKey).length > 0 && (
                                      <div className="object-row object-row-additional">
                                        {getAdditionalEventFields(obj, eventPanelKey).map((field) => (
                                          <div key={`${eventPanelKey}-${field}`}>
                                            <span className={isFieldHighlighted(eventPanelKey, field)
                                              ? 'label label-warning'
                                              : 'label'}>
                                              <span title={getEventFieldDescription(field)}>
                                                {formatEventFieldLabel(field)}
                                              </span>
                                              {renderFieldBadges(eventPanelKey, field, obj, overrideTargets)}
                                              {panelEditState[eventPanelKey] && (
                                                <span className="label-actions">
                                                  <button
                                                    type="button"
                                                    className="builder-link"
                                                    onClick={() => openBuilderForField(obj, eventPanelKey, field)}
                                                    disabled={isFieldLockedByBuilder(eventPanelKey, field)}
                                                  >
                                                    Builder
                                                  </button>
                                                </span>
                                              )}
                                              {overrideTargets.has(`$.event.${field}`) && (
                                                <div className="override-summary" tabIndex={0}>
                                                  <span
                                                    className="pill override-pill pill-inline pill-action"
                                                    title={`Original: ${getBaseEventDisplay(obj, field)}`}
                                                  >
                                                    Override
                                                    {canEditRules && panelEditState[eventPanelKey]
                                                      && overrideValueMap.has(`$.event.${field}`) && (
                                                        <button
                                                          type="button"
                                                          className="pill-close"
                                                          aria-label={`Remove ${field} override`}
                                                          onClick={() => openRemoveOverrideModal(obj, field, eventPanelKey)}
                                                        >
                                                          ×
                                                        </button>
                                                      )}
                                                  </span>
                                                  {renderOverrideSummaryCard(
                                                    obj,
                                                    overrideValueMap,
                                                    [field],
                                                    'Override',
                                                  )}
                                                </div>
                                              )}
                                              {panelEditState[eventPanelKey] && isFieldDirty(obj, eventPanelKey, field) && (
                                                <span className="dirty-indicator" title="Unsaved change">✎</span>
                                              )}
                                            </span>
                                            {panelEditState[eventPanelKey] ? (
                                              <input
                                                className={isFieldHighlighted(eventPanelKey, field)
                                                  ? 'panel-input panel-input-warning'
                                                  : 'panel-input'}
                                                value={panelDrafts?.[eventPanelKey]?.event?.[field] ?? ''}
                                                onChange={(e) => handleEventInputChange(
                                                  obj,
                                                  eventPanelKey,
                                                  field,
                                                  e.target.value,
                                                  e.target.selectionStart,
                                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                )}
                                                disabled={isFieldLockedByBuilder(eventPanelKey, field)}
                                                title={isFieldLockedByBuilder(eventPanelKey, field)
                                                  ? 'Finish or cancel the builder to edit other fields'
                                                  : ''}
                                              />
                                            ) : (
                                              <span className="value">
                                                {renderValue(
                                                  overrideValueMap.get(`$.event.${field}`) ?? obj?.event?.[field],
                                                  obj?.trap?.variables,
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div
                                  className={`object-panel${panelEditState[`${getObjectKey(obj, idx)}:pre`]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <span className="object-panel-title">PreProcessors</span>
                                  </div>
                                  <div className="object-panel-body">
                                    {renderValue(obj?.preProcessors)}
                                  </div>
                                </div>
                                <div
                                  className={`object-panel${panelEditState[`${getObjectKey(obj, idx)}:trap`]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <span className="object-panel-title">Trap Variables</span>
                                  </div>
                                  <div className="object-panel-body">
                                    {renderTrapVariables(obj?.trap?.variables)}
                                  </div>
                                </div>
                              </div>
                              );
                            })
                          )}
                          </div>
                          {isAnyPanelEditing && (
                            <aside className={`builder-sidebar${builderOpen ? '' : ' builder-sidebar-collapsed'}`}>
                              <div className="builder-header">
                                <div>
                                  <h3>Builder</h3>
                                  <div className="builder-target">
                                    {builderTarget ? (
                                      <span className="builder-target-badge">
                                        Editing: {builderTarget.field}
                                      </span>
                                    ) : (
                                      <span className="builder-target-empty">Select a field to begin</span>
                                    )}
                                  </div>
                                </div>
                                <div className="builder-header-actions">
                                  {builderOpen && (
                                    <button
                                      type="button"
                                      className="builder-help-button"
                                      onClick={() => setShowBuilderHelpModal(true)}
                                    >
                                      Help
                                    </button>
                                  )}
                                  {builderTarget && (
                                    <button
                                      type="button"
                                      className="builder-cancel-button"
                                      onClick={closeBuilder}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="builder-toggle"
                                    onClick={() => setBuilderOpen((prev) => !prev)}
                                  >
                                    {builderOpen ? 'Hide' : 'Show'}
                                  </button>
                                </div>
                              </div>
                              {builderOpen && (
                                <div className="builder-body">
                                  <div className="builder-section">
                                    <div className="builder-section-title">
                                      Builder Type{builderFocus ? '' : ' (Select one)'}
                                    </div>
                                    {!isBuilderTargetReady && (
                                      <div className="builder-hint">Select a field in Edit mode.</div>
                                    )}
                                    {isBuilderTargetReady && !builderFocus && (
                                      <div className="builder-hint">Choose Eval or Processor to continue.</div>
                                    )}
                                    {isBuilderTargetReady && builderTarget && (
                                      <div className="builder-lock-note">
                                        Other fields are locked while this builder is active.
                                      </div>
                                    )}
                                    <div className="builder-focus-row">
                                      <button
                                        type="button"
                                        className={builderFocus === 'literal'
                                          ? 'builder-card builder-card-selected'
                                          : 'builder-card'}
                                        disabled={!isBuilderTargetReady || builderTypeLocked === 'literal'}
                                        onClick={() => {
                                          if (builderTypeLocked && builderTypeLocked !== 'literal') {
                                            setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'literal' });
                                            return;
                                          }
                                          applyBuilderTypeSwitch('literal');
                                        }}
                                      >
                                        Literal
                                      </button>
                                      <button
                                        type="button"
                                        className={builderFocus === 'eval'
                                          ? 'builder-card builder-card-selected'
                                          : 'builder-card'}
                                        disabled={!isBuilderTargetReady || builderTypeLocked === 'eval'}
                                        onClick={() => {
                                          if (builderTypeLocked && builderTypeLocked !== 'eval') {
                                            setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'eval' });
                                            return;
                                          }
                                          applyBuilderTypeSwitch('eval');
                                        }}
                                      >
                                        Eval
                                      </button>
                                      <button
                                        type="button"
                                        className={builderFocus === 'processor'
                                          ? 'builder-card builder-card-selected'
                                          : 'builder-card'}
                                        disabled={!isBuilderTargetReady || builderTypeLocked === 'processor'}
                                        onClick={() => {
                                          if (builderTypeLocked && builderTypeLocked !== 'processor') {
                                            setBuilderSwitchModal({ open: true, from: builderTypeLocked, to: 'processor' });
                                            return;
                                          }
                                          applyBuilderTypeSwitch('processor');
                                        }}
                                      >
                                        Processor
                                      </button>
                                    </div>
                                  </div>
                                  {builderFocus === 'literal' && (
                                    <div className="builder-section">
                                      <div className="builder-section-title">Literal Editor</div>
                                      <div className="builder-regular-input">
                                        <textarea
                                          className="builder-textarea"
                                          placeholder="Enter literal value"
                                          value={builderLiteralText}
                                          onChange={(e) => handleLiteralInputChange(
                                            e.target.value,
                                            e.target.selectionStart,
                                            (e.nativeEvent as InputEvent | undefined)?.inputType,
                                          )}
                                          disabled={!isBuilderTargetReady}
                                        />
                                      </div>
                                      <div className="builder-regular-actions">
                                        <button
                                          type="button"
                                          className="builder-card builder-card-primary"
                                          disabled={!isBuilderTargetReady || !literalDirty}
                                          onClick={applyLiteralValue}
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {builderFocus === 'eval' && (
                                    <div className="builder-section">
                                      <div className="builder-section-title">Eval Builder</div>
                                      <div className="builder-mode-row">
                                        <div className="builder-mode-toggle">
                                          <button
                                            type="button"
                                            className={builderMode === 'friendly'
                                              ? 'builder-mode-button builder-mode-button-active'
                                              : 'builder-mode-button'}
                                            onClick={() => setBuilderMode('friendly')}
                                          >
                                            Friendly
                                          </button>
                                          <button
                                            type="button"
                                            className={builderMode === 'regular'
                                              ? 'builder-mode-button builder-mode-button-active'
                                              : 'builder-mode-button'}
                                            onClick={() => setBuilderMode('regular')}
                                          >
                                            Regular
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          className="builder-link"
                                          onClick={() => {
                                            setAdvancedProcessorScope('object');
                                            setShowAdvancedProcessorModal(true);
                                          }}
                                        >
                                          Advanced Processors
                                        </button>
                                      </div>
                                      {builderMode === 'friendly' ? (
                                        <div className="builder-friendly">
                                          <div className="builder-friendly-rows">
                                            {builderConditions.map((row) => (
                                              <div className="builder-condition-block" key={row.id}>
                                                {row.condition.type === 'condition' ? (
                                                  <>
                                                    <div className="builder-friendly-row">
                                                      <input
                                                        className="builder-input"
                                                        value={row.condition.left}
                                                        onChange={(e) => updateBuilderCondition(
                                                          row.id,
                                                          row.condition.id,
                                                          'left',
                                                          e.target.value,
                                                        )}
                                                        placeholder="$v1"
                                                        disabled={!isBuilderTargetReady}
                                                        title={row.condition.left}
                                                      />
                                                      <select
                                                        className="builder-select"
                                                        value={row.condition.operator}
                                                        onChange={(e) => updateBuilderCondition(
                                                          row.id,
                                                          row.condition.id,
                                                          'operator',
                                                          e.target.value,
                                                        )}
                                                        disabled={!isBuilderTargetReady}
                                                      >
                                                        <option value="==">==</option>
                                                        <option value="!=">!=</option>
                                                        <option value=">">&gt;</option>
                                                        <option value=">=">&gt;=</option>
                                                        <option value="<">&lt;</option>
                                                        <option value="<=">&lt;=</option>
                                                      </select>
                                                      <input
                                                        className="builder-input"
                                                        value={row.condition.right}
                                                        onChange={(e) => updateBuilderCondition(
                                                          row.id,
                                                          row.condition.id,
                                                          'right',
                                                          e.target.value,
                                                        )}
                                                        placeholder="1"
                                                        disabled={!isBuilderTargetReady}
                                                        title={row.condition.right}
                                                      />
                                                      <span className="builder-friendly-arrow">→</span>
                                                      <input
                                                        className="builder-input builder-input-result"
                                                        value={row.result}
                                                        onChange={(e) => updateBuilderResult(row.id, e.target.value)}
                                                        placeholder="result"
                                                        disabled={!isBuilderTargetReady}
                                                        title={row.result}
                                                      />
                                                      <button
                                                        type="button"
                                                        className="builder-remove"
                                                        onClick={() => removeBuilderRow(row.id)}
                                                        disabled={!isBuilderTargetReady || builderConditions.length === 1}
                                                        aria-label="Remove condition"
                                                      >
                                                        ×
                                                      </button>
                                                    </div>
                                                    <div className="builder-group-actions">
                                                      <button
                                                        type="button"
                                                        className="builder-link"
                                                        onClick={() => {
                                                          const newChild = createConditionNode();
                                                          setBuilderConditions((prev) => prev.map((item) => (
                                                            item.id === row.id
                                                              ? {
                                                                ...item,
                                                                condition: {
                                                                  id: nextBuilderId(),
                                                                  type: 'group',
                                                                  operator: 'AND',
                                                                  children: [item.condition, newChild],
                                                                },
                                                              }
                                                              : item
                                                          )));
                                                        }}
                                                        disabled={!isBuilderTargetReady}
                                                      >
                                                        Add condition
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="builder-link"
                                                        onClick={() => {
                                                          const newGroup = createGroupNode();
                                                          setBuilderConditions((prev) => prev.map((item) => (
                                                            item.id === row.id
                                                              ? {
                                                                ...item,
                                                                condition: {
                                                                  id: nextBuilderId(),
                                                                  type: 'group',
                                                                  operator: 'AND',
                                                                  children: [item.condition, newGroup],
                                                                },
                                                              }
                                                              : item
                                                          )));
                                                        }}
                                                        disabled={!isBuilderTargetReady}
                                                      >
                                                        Add group
                                                      </button>
                                                    </div>
                                                  </>
                                                ) : (
                                                  <div className="builder-group-row">
                                                    {renderConditionNode(row.id, row.condition, 0, false, 1)}
                                                    <div className="builder-group-result">
                                                      <span className="builder-friendly-arrow">→</span>
                                                      <input
                                                        className="builder-input builder-input-result"
                                                        value={row.result}
                                                        onChange={(e) => updateBuilderResult(row.id, e.target.value)}
                                                        placeholder="result"
                                                        disabled={!isBuilderTargetReady}
                                                        title={row.result}
                                                      />
                                                      <button
                                                        type="button"
                                                        className="builder-remove"
                                                        onClick={() => removeBuilderRow(row.id)}
                                                        disabled={!isBuilderTargetReady || builderConditions.length === 1}
                                                        aria-label="Remove condition"
                                                      >
                                                        ×
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                          <button
                                            type="button"
                                            className="builder-link"
                                            onClick={addBuilderRow}
                                            disabled={!isBuilderTargetReady}
                                          >
                                            Add condition
                                          </button>
                                          <div className="builder-friendly-else">
                                            <span className="builder-friendly-label">Else</span>
                                            <input
                                              className="builder-input"
                                              value={builderElseResult}
                                              onChange={(e) => setBuilderElseResult(e.target.value)}
                                              placeholder="0"
                                              disabled={!isBuilderTargetReady}
                                            />
                                          </div>
                                          <div className="builder-friendly-actions">
                                            <button
                                              type="button"
                                              className="builder-card builder-card-primary"
                                              disabled={!isBuilderTargetReady || !friendlyPreview}
                                              onClick={applyFriendlyEval}
                                            >
                                              Apply
                                            </button>
                                          </div>
                                          {isBuilderTargetReady && !friendlyPreview && (
                                            <div className="builder-hint builder-hint-warning">
                                              Complete each condition and the Else value to enable Apply.
                                            </div>
                                          )}
                                          <div className="builder-preview">
                                            <div className="builder-preview-label">Preview</div>
                                            <div className="builder-preview-value">
                                              {friendlyPreview || '—'}
                                            </div>
                                            {friendlyPreview && (
                                              <details className="builder-preview-details">
                                                <summary>Expanded view</summary>
                                                <div className="builder-preview-lines">
                                                  {formatEvalReadableList(friendlyPreview).map((line, idx) => (
                                                    <span key={`${line}-${idx}`}>{line}</span>
                                                  ))}
                                                </div>
                                              </details>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="builder-regular">
                                          <div className="builder-regular-input">
                                            <textarea
                                              className="builder-textarea"
                                              placeholder="Enter raw eval expression"
                                              value={builderRegularText}
                                              onChange={(e) => handleRegularEvalInputChange(
                                                e.target.value,
                                                e.target.selectionStart,
                                                (e.nativeEvent as InputEvent | undefined)?.inputType,
                                              )}
                                              disabled={!isBuilderTargetReady}
                                            />
                                            {builderRegularText && (
                                              <button
                                                type="button"
                                                className="builder-clear"
                                                onClick={clearRegularEval}
                                                aria-label="Clear eval"
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                          <div className="builder-regular-actions">
                                            <button
                                              type="button"
                                              className="builder-card builder-card-primary"
                                              disabled={!isBuilderTargetReady || !builderRegularText.trim()}
                                              onClick={applyRegularEval}
                                            >
                                              Apply
                                            </button>
                                          </div>
                                          {isBuilderTargetReady && !builderRegularText.trim() && (
                                            <div className="builder-hint builder-hint-warning">
                                              Enter an expression to enable Apply.
                                            </div>
                                          )}
                                          <div className="builder-regular-templates">
                                            <div className="builder-example-title">Templates</div>
                                            <button
                                              type="button"
                                              className="builder-card"
                                              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                                              onClick={() => applyBuilderTemplate('($v1==1) ? 1 : 0')}
                                            >
                                              Ternary (if/else)
                                            </button>
                                            <button
                                              type="button"
                                              className="builder-card"
                                              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                                              onClick={() => applyBuilderTemplate('($v1==1) ? 1 : (($v1==2) ? 2 : 0)')}
                                            >
                                              Else-if chain
                                            </button>
                                            <button
                                              type="button"
                                              className="builder-card"
                                              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
                                              onClick={() => applyBuilderTemplate('$v1')}
                                            >
                                              Variable ($vN)
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {builderFocus === 'processor' && (
                                    <div className="builder-section processor-builder">
                                      <div className="builder-section-title-row">
                                        <div className="builder-section-title">Processor Builder</div>
                                        <button
                                          type="button"
                                          className="builder-link"
                                          onClick={() => {
                                            setAdvancedProcessorScope('object');
                                            setShowAdvancedProcessorModal(true);
                                          }}
                                        >
                                          Advanced Flow
                                        </button>
                                      </div>
                                      {!isBuilderTargetReady && (
                                        <div className="builder-hint">Select a field in Edit mode.</div>
                                      )}
                                      {isBuilderTargetReady && (
                                        <>
                                          <div className="processor-steps">
                                            {['select', 'configure', 'review'].map((step) => (
                                              <button
                                                key={step}
                                                type="button"
                                                className={processorStep === step
                                                  ? 'processor-step processor-step-active'
                                                  : 'processor-step'}
                                                disabled={
                                                  (step === 'configure' && !processorType)
                                                  || (step === 'review' && !buildProcessorPayload())
                                                }
                                                title={
                                                  step === 'configure' && !processorType
                                                    ? 'Select a processor to enable.'
                                                    : step === 'review' && !buildProcessorPayload()
                                                      ? 'Complete configuration to enable.'
                                                      : ''
                                                }
                                                onClick={() => {
                                                  if (step === 'configure' && !processorType) {
                                                    return;
                                                  }
                                                  if (step === 'review' && !buildProcessorPayload()) {
                                                    return;
                                                  }
                                                  setProcessorStep(step as typeof processorStep);
                                                }}
                                              >
                                                {step}
                                              </button>
                                            ))}
                                          </div>
                                          {processorStep === 'select' && (
                                            <div className="processor-grid">
                                              {processorCatalog.map((item) => {
                                                const isSelected = processorType === item.id;
                                                const isEnabled = item.status !== 'planned';
                                                const buttonLabel = item.paletteLabel || item.label;
                                                return (
                                                  <div key={item.id} className="processor-card">
                                                    <button
                                                      type="button"
                                                      className={isSelected
                                                        ? 'builder-card builder-card-selected'
                                                        : 'builder-card'}
                                                      onClick={() => handleBuilderSelect(item, isEnabled)}
                                                      disabled={!isEnabled}
                                                    >
                                                      {buttonLabel}
                                                    </button>
                                                    {renderProcessorHelp(item.helpKey)}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {processorStep === 'configure' && processorType === 'set' && (
                                            <div className="processor-form">
                                              <div className="builder-section-title">Processor: Set</div>
                                              <div className="processor-row">
                                                <label className="builder-label">Source type</label>
                                                <div className="builder-mode-toggle">
                                                  <button
                                                    type="button"
                                                    className={processorDraft.sourceType === 'literal'
                                                      ? 'builder-mode-button builder-mode-button-active'
                                                      : 'builder-mode-button'}
                                                    onClick={() => setProcessorDraft((prev) => ({
                                                      ...prev,
                                                      sourceType: 'literal',
                                                    }))}
                                                  >
                                                    Literal
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={processorDraft.sourceType === 'path'
                                                      ? 'builder-mode-button builder-mode-button-active'
                                                      : 'builder-mode-button'}
                                                    onClick={() => setProcessorDraft((prev) => ({
                                                      ...prev,
                                                      sourceType: 'path',
                                                    }))}
                                                  >
                                                    Path
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="processor-row">
                                                <label className="builder-label">Source</label>
                                                <div className="builder-inline-input">
                                                  <input
                                                    className="builder-input"
                                                    value={processorDraft.source}
                                                    placeholder={processorDraft.sourceType === 'path'
                                                      ? '$.event.Summary or $v1'
                                                      : 'Literal value or $v1'}
                                                    onChange={(e) => handleProcessorSourceChange(
                                                      e.target.value,
                                                      e.target.selectionStart,
                                                      (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                    )}
                                                  />
                                                  <button
                                                    type="button"
                                                    className="builder-link builder-var-button"
                                                    title="Insert variable"
                                                    onClick={() => {
                                                      if (!builderTarget) {
                                                        return;
                                                      }
                                                      const obj = getObjectByPanelKey(builderTarget.panelKey);
                                                      const trapVars = obj?.trap?.variables || [];
                                                      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
                                                      openVarInsertModal(
                                                        builderTarget.panelKey,
                                                        'processorSource',
                                                        processorDraft.source,
                                                      );
                                                    }}
                                                  >
                                                    ⋯
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="processor-row">
                                                <label className="builder-label">Target</label>
                                                <input
                                                  className="builder-input"
                                                  value={processorDraft.targetField}
                                                  placeholder="$.event.EventType"
                                                  onChange={(e) => handleProcessorTargetChange(
                                                    e.target.value,
                                                    e.target.selectionStart,
                                                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                  )}
                                                />
                                              </div>
                                              <div className="processor-actions">
                                                <button
                                                  type="button"
                                                  className="builder-card"
                                                  onClick={() => setProcessorStep('review')}
                                                >
                                                  Review
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                          {processorStep === 'configure' && processorType === 'regex' && (
                                            <div className="processor-form">
                                              <div className="builder-section-title">Processor: Regex</div>
                                              <div className="processor-row">
                                                <label className="builder-label">Source type</label>
                                                <div className="builder-mode-toggle">
                                                  <button
                                                    type="button"
                                                    className={processorDraft.sourceType === 'literal'
                                                      ? 'builder-mode-button builder-mode-button-active'
                                                      : 'builder-mode-button'}
                                                    onClick={() => setProcessorDraft((prev) => ({
                                                      ...prev,
                                                      sourceType: 'literal',
                                                    }))}
                                                  >
                                                    Literal
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={processorDraft.sourceType === 'path'
                                                      ? 'builder-mode-button builder-mode-button-active'
                                                      : 'builder-mode-button'}
                                                    onClick={() => setProcessorDraft((prev) => ({
                                                      ...prev,
                                                      sourceType: 'path',
                                                    }))}
                                                  >
                                                    Path
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="processor-row">
                                                <label className="builder-label">Source</label>
                                                <div className="builder-inline-input">
                                                  <input
                                                    className="builder-input"
                                                    value={processorDraft.source}
                                                    placeholder={processorDraft.sourceType === 'path'
                                                      ? '$.event.Summary or $v1'
                                                      : 'Literal value or $v1'}
                                                    onChange={(e) => handleProcessorSourceChange(
                                                      e.target.value,
                                                      e.target.selectionStart,
                                                      (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                    )}
                                                  />
                                                  <button
                                                    type="button"
                                                    className="builder-link builder-var-button"
                                                    title="Insert variable"
                                                    onClick={() => {
                                                      if (!builderTarget) {
                                                        return;
                                                      }
                                                      const obj = getObjectByPanelKey(builderTarget.panelKey);
                                                      const trapVars = obj?.trap?.variables || [];
                                                      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
                                                      openVarInsertModal(
                                                        builderTarget.panelKey,
                                                        'processorSource',
                                                        processorDraft.source,
                                                      );
                                                    }}
                                                  >
                                                    ⋯
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="processor-row">
                                                <label className="builder-label">Pattern</label>
                                                <input
                                                  className="builder-input"
                                                  value={processorDraft.pattern}
                                                  placeholder="type=(\\w+)"
                                                  onChange={(e) => setProcessorDraft((prev) => ({
                                                    ...prev,
                                                    pattern: e.target.value,
                                                  }))}
                                                />
                                              </div>
                                              <div className="processor-row">
                                                <label className="builder-label">Target</label>
                                                <input
                                                  className="builder-input"
                                                  value={processorDraft.targetField}
                                                  placeholder="$.event.EventType"
                                                  onChange={(e) => handleProcessorTargetChange(
                                                    e.target.value,
                                                    e.target.selectionStart,
                                                    (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                  )}
                                                />
                                              </div>
                                              <div className="processor-actions">
                                                <button
                                                  type="button"
                                                  className="builder-card"
                                                  onClick={() => setProcessorStep('review')}
                                                >
                                                  Review
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                          {processorStep === 'configure'
                                            && processorType
                                            && !['set', 'regex'].includes(processorType)
                                            && (
                                              <div className="processor-form">
                                                <div className="builder-section-title">
                                                  Processor: {formatEventFieldLabel(processorType)}
                                                </div>
                                                <div className="builder-hint">
                                                  Configure this processor in Advanced Flow.
                                                </div>
                                                <div className="processor-actions">
                                                  <button
                                                    type="button"
                                                    className="builder-card"
                                                    onClick={() => {
                                                      setAdvancedProcessorScope('object');
                                                      setShowAdvancedProcessorModal(true);
                                                    }}
                                                  >
                                                    Open Advanced Flow
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          {processorStep === 'review' && (
                                            <div className="processor-review">
                                              <div className="builder-preview">
                                                <div className="builder-preview-header">
                                                  <div className="builder-preview-label">Preview</div>
                                                  <button
                                                    type="button"
                                                    className="builder-link"
                                                    onClick={() => setShowProcessorJson((prev) => !prev)}
                                                  >
                                                    {showProcessorJson ? 'Hide JSON' : 'Show JSON'}
                                                  </button>
                                                </div>
                                                {showProcessorJson && (
                                                  <div className="builder-preview-value">
                                                    {JSON.stringify(buildProcessorPayload(), null, 2) || '—'}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="processor-actions">
                                                <button
                                                  type="button"
                                                  className="ghost-button"
                                                  onClick={() => setProcessorStep('configure')}
                                                >
                                                  Back
                                                </button>
                                                <button
                                                  type="button"
                                                  className="builder-card builder-card-primary"
                                                  onClick={applyProcessor}
                                                  disabled={!buildProcessorPayload()}
                                                >
                                                  Apply
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </aside>
                          )}
                        </div>
                      ) : (
                        <pre>{JSON.stringify(getPreviewContent(fileData), null, 2)}</pre>
                      )
                    )}
                  </div>
                  {showCommitModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Commit message</h3>
                        <input
                          type="text"
                          placeholder="Enter commit message here"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                        />
                        <div className="modal-actions">
                          <button type="button" onClick={() => {
                            setPendingOverrideSave(null);
                            setShowCommitModal(false);
                          }}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingOverrideSave) {
                                handleSaveOverrides(commitMessage);
                              } else {
                                handleSaveFile(commitMessage);
                              }
                              setShowCommitModal(false);
                            }}
                            disabled={saveLoading}
                          >
                            {saveLoading ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showBuilderHelpModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        <h3>Builder Help</h3>
                        <div className="builder-help-section">
                          <h4>Processor Builder</h4>
                          <p>
                            Use processors to transform or set event fields after a match. Select a processor,
                            configure inputs, and review the generated JSON before applying.
                          </p>
                          <ul>
                            <li><strong>Set</strong>: assign a literal or copy from a field path.</li>
                            <li><strong>Regex</strong>: extract a value using a capture group.</li>
                          </ul>
                        </div>
                        <div className="builder-help-section">
                          <h4>Eval Builder</h4>
                          <p>
                            Use Friendly for guided conditions or Regular for raw expressions. Click $v tokens to
                            see trap variable details.
                          </p>
                        </div>
                        <div className="builder-help-section">
                          <h4>References</h4>
                          <p>Docs: architecture/FCOM_Curation_UI_Plan.md</p>
                          <p>UA REST/processor docs (internal UA documentation).</p>
                        </div>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowBuilderHelpModal(false)}>Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showAdvancedProcessorModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-flow">
                        <div className="flow-modal-header">
                          <h3>
                            {advancedProcessorScope === 'global'
                              ? 'Advanced Processors (Global)'
                              : 'Advanced Processors (Object)'}
                          </h3>
                          <button
                            type="button"
                            className="flow-modal-close"
                            onClick={() => setShowAdvancedProcessorModal(false)}
                          >
                            Close
                          </button>
                        </div>
                        <div className="flow-modal-subtitle">
                          {advancedProcessorScope === 'global'
                            ? 'Wireframe: configure global pre/post processors for the file. Drag from the palette into the lanes.'
                            : 'Wireframe: configure object processors. Drag from the palette into the flow lanes.'}
                        </div>
                        <div className="flow-modal-body">
                          <div className="flow-palette">
                            <div className="flow-palette-title">Palette</div>
                            <input
                              className="flow-palette-search"
                              placeholder="Search processors"
                              value={advancedProcessorSearch}
                              onChange={(event) => setAdvancedProcessorSearch(event.target.value)}
                            />
                            <div className="flow-palette-list">
                              {paletteSections.map((section) => (
                                <div key={section.status} className="flow-palette-section">
                                  <div className="flow-palette-section-title">{section.title}</div>
                                  {section.items.length === 0 ? (
                                    <div className="flow-palette-empty">None</div>
                                  ) : (
                                    <div className="flow-palette-section-grid">
                                      {section.items.map((item) => {
                                        const isEnabled = item.status !== 'planned';
                                        return (
                                          <div
                                            key={`${item.label}-${item.nodeKind}`}
                                            className={isEnabled
                                              ? 'flow-palette-item'
                                              : 'flow-palette-item flow-palette-item-disabled'}
                                            draggable={isEnabled}
                                            onDragStart={(event) => {
                                              if (!isEnabled) {
                                                return;
                                              }
                                              const payload = JSON.stringify({
                                                source: 'palette',
                                                nodeKind: item.nodeKind,
                                                processorType: item.processorType,
                                              });
                                              event.dataTransfer.setData('application/json', payload);
                                              event.dataTransfer.setData('text/plain', payload);
                                              event.dataTransfer.effectAllowed = 'copyMove';
                                            }}
                                          >
                                            <span>{item.label}</span>
                                            {renderProcessorHelp((item.nodeKind === 'if'
                                              ? 'if'
                                              : item.processorType) as keyof typeof processorHelp)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flow-canvas">
                            {advancedProcessorScope === 'global' ? (
                              <>
                                <div className="flow-canvas-title">Global Flow</div>
                                <div className="flow-global-sections">
                                  <div className="flow-global-section">
                                    <div className="flow-global-title">Pre</div>
                                    {renderFlowList(globalPreFlow, { kind: 'root' }, setGlobalPreFlow, 'global', 'pre')}
                                  </div>
                                  <div className="flow-global-section">
                                    <div className="flow-global-title">Post</div>
                                    {renderFlowList(globalPostFlow, { kind: 'root' }, setGlobalPostFlow, 'global', 'post')}
                                  </div>
                                </div>
                                <div className="flow-preview">
                                  <div className="flow-preview-title">JSON Preview</div>
                                  <pre className="flow-preview-code">
                                    {JSON.stringify({
                                      pre: buildFlowProcessors(globalPreFlow),
                                      post: buildFlowProcessors(globalPostFlow),
                                    }, null, 2)}
                                  </pre>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flow-canvas-title">Flow</div>
                                {renderFlowList(advancedFlow, { kind: 'root' }, setAdvancedFlow, 'object', 'object')}
                                <div className="flow-preview">
                                  <div className="flow-preview-title">JSON Preview</div>
                                  <pre className="flow-preview-code">
                                    {JSON.stringify(buildFlowProcessors(advancedFlow), null, 2)}
                                  </pre>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {flowEditor && flowEditorDraft && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        <div className="flow-editor-header">
                          <h3>
                            Configure Processor
                            {flowEditorDraft ? ` — ${getFlowNodeLabel(flowEditorDraft)}` : ''}
                          </h3>
                          <button
                            type="button"
                            className="builder-link"
                            onClick={() => setShowFieldReferenceModal(true)}
                          >
                            Field reference
                          </button>
                        </div>
                        {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType] && (
                          <div className="builder-hint">
                            <div>
                              {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType].description}
                            </div>
                            <div className="builder-example-row">
                              <button
                                type="button"
                                className="builder-link"
                                onClick={applyFlowEditorExample}
                              >
                                Apply example
                              </button>
                              <span className="builder-example-code">
                                {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType].example}
                              </span>
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'processor' && flowEditorDraft.processorType === 'set' && (
                          <div className="processor-form">
                            <div className="processor-row">
                              <label className="builder-label">Source type</label>
                              <div className="builder-mode-toggle">
                                <button
                                  type="button"
                                  className={(flowEditorDraft.config?.sourceType || 'literal') === 'literal'
                                    ? 'builder-mode-button builder-mode-button-active'
                                    : 'builder-mode-button'}
                                  onClick={() => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        sourceType: 'literal',
                                      },
                                    }
                                    : prev))}
                                >
                                  Literal
                                </button>
                                <button
                                  type="button"
                                  className={(flowEditorDraft.config?.sourceType || 'literal') === 'path'
                                    ? 'builder-mode-button builder-mode-button-active'
                                    : 'builder-mode-button'}
                                  onClick={() => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        sourceType: 'path',
                                      },
                                    }
                                    : prev))}
                                >
                                  Path
                                </button>
                              </div>
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Source</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.config?.source || ''}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.source',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Target</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.config?.targetField || ''}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.targetField',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Args (optional JSON array)</label>
                              <input
                                className="builder-input"
                                placeholder='["$.event.Node", "$.event.EventType"]'
                                value={flowEditorDraft.config?.argsText || ''}
                                onChange={(e) => setFlowEditorDraft((prev) => (prev
                                  ? {
                                    ...prev,
                                    config: {
                                      ...(prev as FlowProcessorNode).config,
                                      argsText: e.target.value,
                                    },
                                  }
                                  : prev))}
                              />
                              {flowEditorArgsError && (
                                <div className="builder-hint builder-hint-warning">{flowEditorArgsError}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'processor' && flowEditorDraft.processorType === 'regex' && (
                          <div className="processor-form">
                            <div className="processor-row">
                              <label className="builder-label">Source</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.config?.source || ''}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.source',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Pattern</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.config?.pattern || ''}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.pattern',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Target</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.config?.targetField || ''}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.targetField',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'if' && (
                          <div className="processor-form">
                            <div className="processor-row">
                              <label className="builder-label">Property</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.condition.property}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.condition.property',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Operator</label>
                              <select
                                className="builder-select"
                                value={flowEditorDraft.condition.operator}
                                onChange={(e) => setFlowEditorDraft((prev) => (prev
                                  ? {
                                    ...prev,
                                    condition: {
                                      ...(prev as FlowIfNode).condition,
                                      operator: e.target.value,
                                    },
                                  }
                                  : prev))}
                              >
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="=~">=~</option>
                              </select>
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Value</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.condition.value}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.condition.value',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'processor'
                          && flowEditorDraft.processorType === 'foreach'
                          && (
                            <div className="processor-form">
                              <div className="processor-row">
                                <label className="builder-label">Source</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.source || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        source: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Key</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.keyVal || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        keyVal: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Value</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.valField || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        valField: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Processors</label>
                                {renderFlowList(
                                  Array.isArray(flowEditorDraft.config?.processors)
                                    ? (flowEditorDraft.config?.processors as FlowNode[])
                                    : [],
                                  { kind: 'root' },
                                  (updater) => {
                                    setFlowEditorDraft((prev) => {
                                      if (!prev || prev.kind !== 'processor') {
                                        return prev;
                                      }
                                      const current = Array.isArray(prev.config?.processors)
                                        ? prev.config.processors
                                        : [];
                                      const next = typeof updater === 'function'
                                        ? (updater as (items: FlowNode[]) => FlowNode[])(current)
                                        : updater;
                                      return {
                                        ...prev,
                                        config: {
                                          ...(prev as FlowProcessorNode).config,
                                          processors: next,
                                        },
                                      } as FlowNode;
                                    });
                                  },
                                  flowEditor?.scope || 'object',
                                  flowEditor?.lane || 'object',
                                )}
                              </div>
                            </div>
                          )}
                        {flowEditorDraft.kind === 'processor'
                          && flowEditorDraft.processorType === 'switch'
                          && (
                            <div className="processor-form">
                              <div className="processor-row">
                                <label className="builder-label">Source</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.source || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        source: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Operator</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.operator || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        operator: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Cases</label>
                                <div className="flow-switch-cases">
                                  {(Array.isArray(flowEditorDraft.config?.cases)
                                    ? flowEditorDraft.config?.cases
                                    : []).map((item: any) => (
                                      <div key={item.id} className="flow-switch-case">
                                        <div className="flow-switch-case-row">
                                          <label className="builder-label">Match</label>
                                          <input
                                            className="builder-input"
                                            value={item.match ?? ''}
                                            onChange={(e) => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.map((entry: any) => (
                                                    entry.id === item.id
                                                      ? { ...entry, match: e.target.value }
                                                      : entry
                                                  )),
                                                },
                                              } as FlowNode;
                                            })}
                                          />
                                        </div>
                                        <div className="flow-switch-case-row">
                                          <label className="builder-label">Operator (optional)</label>
                                          <input
                                            className="builder-input"
                                            value={item.operator ?? ''}
                                            onChange={(e) => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.map((entry: any) => (
                                                    entry.id === item.id
                                                      ? { ...entry, operator: e.target.value }
                                                      : entry
                                                  )),
                                                },
                                              } as FlowNode;
                                            })}
                                          />
                                        </div>
                                        <div className="flow-switch-case-row">
                                          <button
                                            type="button"
                                            className="builder-link"
                                            onClick={() => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.filter((entry: any) => entry.id !== item.id),
                                                },
                                              } as FlowNode;
                                            })}
                                          >
                                            Remove case
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  <button
                                    type="button"
                                    className="builder-link"
                                    onClick={() => setFlowEditorDraft((prev) => {
                                      if (!prev || prev.kind !== 'processor') {
                                        return prev;
                                      }
                                      const cases = Array.isArray(prev.config?.cases)
                                        ? prev.config.cases
                                        : [];
                                      return {
                                        ...prev,
                                        config: {
                                          ...(prev as FlowProcessorNode).config,
                                          cases: [
                                            ...cases,
                                            {
                                              id: nextSwitchCaseId(),
                                              match: '',
                                              operator: '',
                                              processors: [],
                                            },
                                          ],
                                        },
                                      } as FlowNode;
                                    })}
                                  >
                                    Add case
                                  </button>
                                </div>
                              </div>
                              <div className="builder-hint">
                                Drag processors into each case or the Default lane on the canvas.
                              </div>
                            </div>
                          )}
                        {flowEditorDraft.kind === 'processor'
                          && !['set', 'regex', 'foreach', 'switch'].includes(flowEditorDraft.processorType)
                          && (
                            <div className="processor-form">
                              {(flowProcessorConfigSpecs[flowEditorDraft.processorType] || []).length === 0 ? (
                                <div className="builder-hint">
                                  No configuration required for this processor.
                                </div>
                              ) : (
                                flowProcessorConfigSpecs[flowEditorDraft.processorType].map((field) => {
                                  const isJsonField = field.type === 'json';
                                  const valueKey = isJsonField ? `${field.key}Text` : field.key;
                                  const value = (flowEditorDraft.config?.[valueKey] ?? '') as string | boolean;
                                  const jsonError = isJsonField && String(value).trim()
                                    ? (() => {
                                      try {
                                        JSON.parse(String(value));
                                        return '';
                                      } catch {
                                        return `${field.label} must be valid JSON.`;
                                      }
                                    })()
                                    : '';
                                  return (
                                    <div key={field.key} className="processor-row">
                                      <label className="builder-label">{field.label}</label>
                                      {field.type === 'boolean' ? (
                                        <select
                                          className="builder-select"
                                          value={value ? 'true' : 'false'}
                                          onChange={(e) => setFlowEditorDraft((prev) => (prev
                                            ? {
                                              ...prev,
                                              config: {
                                                ...(prev as FlowProcessorNode).config,
                                                [field.key]: e.target.value === 'true',
                                              },
                                            }
                                            : prev))}
                                        >
                                          <option value="false">false</option>
                                          <option value="true">true</option>
                                        </select>
                                      ) : isJsonField ? (
                                        <textarea
                                          className="builder-textarea"
                                          placeholder={field.placeholder}
                                          value={value as string}
                                          onChange={(e) => setFlowEditorDraft((prev) => (prev
                                            ? {
                                              ...prev,
                                              config: {
                                                ...(prev as FlowProcessorNode).config,
                                                [valueKey]: e.target.value,
                                              },
                                            }
                                            : prev))}
                                        />
                                      ) : (
                                        <input
                                          className="builder-input"
                                          placeholder={field.placeholder}
                                          value={value as string}
                                          onChange={(e) => setFlowEditorDraft((prev) => (prev
                                            ? {
                                              ...prev,
                                              config: {
                                                ...(prev as FlowProcessorNode).config,
                                                [field.key]: e.target.value,
                                              },
                                            }
                                            : prev))}
                                        />
                                      )}
                                      {jsonError && (
                                        <div className="builder-hint builder-hint-warning">{jsonError}</div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        {flowEditorJsonErrors.length > 0 && (
                          <div className="builder-hint builder-hint-warning">
                            {flowEditorJsonErrors.map((item) => (
                              <div key={item.field}>{item.message}</div>
                            ))}
                          </div>
                        )}
                        {isPreGlobalFlow && hasPreScopeEventUsage(flowEditorDraft) && (
                          <div className="builder-hint builder-hint-warning">
                            Pre scope cannot reference $.event.*. Remove those paths or move this processor to post.
                          </div>
                        )}
                        <div className="modal-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setFlowEditor(null);
                              setFlowEditorDraft(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              (isPreGlobalFlow && hasPreScopeEventUsage(flowEditorDraft))
                              || flowEditorJsonErrors.length > 0
                            }
                            onClick={() => {
                              if (!flowEditor || !flowEditorDraft) {
                                return;
                              }
                              if (isPreGlobalFlow && hasPreScopeEventUsage(flowEditorDraft)) {
                                return;
                              }
                              if (flowEditorJsonErrors.length > 0) {
                                return;
                              }
                              const setNodes = flowEditor.setNodesOverride
                                || getFlowStateByLane(flowEditor.scope, flowEditor.lane).setNodes;
                              setNodes((prev) => replaceNodeById(prev, flowEditor.nodeId, flowEditorDraft));
                              setFlowEditor(null);
                              setFlowEditorDraft(null);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showFieldReferenceModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        <h3>Field Reference</h3>
                        <div className="field-reference">
                          <div className="field-reference-section">
                            <div className="field-reference-title">Common JSON paths</div>
                            <ul>
                              <li>$.event.* (post scope event fields)</li>
                              <li>$.trap.*, $.syslog.* (method-specific inputs)</li>
                              <li>$.localmem.* (per-event memory)</li>
                              <li>$.globalmem.* (requires Coherence)</li>
                              <li>$.lookups.&lt;lookup&gt;.&lt;key&gt;</li>
                              <li>$.foreach.&lt;keyField|valField&gt;</li>
                              <li>$.error.message</li>
                            </ul>
                          </div>
                          <div className="field-reference-section">
                            <div className="field-reference-title">Event fields (UA schema)</div>
                            {eventsSchemaFields.length === 0 ? (
                              <div className="field-reference-empty">
                                No schema fields loaded.
                              </div>
                            ) : (
                              <div className="field-reference-grid">
                                {eventsSchemaFields.map((field) => (
                                  <span
                                    key={field}
                                    className="field-reference-chip"
                                    title={getEventFieldDescription(field)}
                                  >
                                    $.event.{field}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowFieldReferenceModal(false)}>Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {builderSwitchModal.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Switch builder type</h3>
                        <p>
                          Switch from {builderSwitchModal.from} to {builderSwitchModal.to}? This will replace the
                          current configuration.
                        </p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setBuilderSwitchModal({ open: false })}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (builderSwitchModal.to) {
                                applyBuilderTypeSwitch(builderSwitchModal.to);
                              }
                              setBuilderSwitchModal({ open: false });
                            }}
                          >
                            Switch
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {removeOverrideModal.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Remove override</h3>
                        <p>Removing this override will default to original value:</p>
                        <pre className="code-block">{removeOverrideModal.baseValue ?? '—'}</pre>
                        <p>Are you sure?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setRemoveOverrideModal({ open: false })}>
                            No
                          </button>
                          <button type="button" onClick={confirmRemoveOverride}>
                            Yes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {removeAllOverridesModal.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Remove all overrides</h3>
                        <p>Removing these overrides will default to original values:</p>
                        <pre className="code-block">{JSON.stringify(removeAllOverridesModal.baseValues ?? {}, null, 2)}</pre>
                        <p>Are you sure?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setRemoveAllOverridesModal({ open: false })}>
                            No
                          </button>
                          <button type="button" onClick={confirmRemoveAllOverrides}>
                            Yes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {processorTooltip && (
                    <div
                      className="floating-help-tooltip"
                      style={{ left: processorTooltip.x, top: processorTooltip.y }}
                      role="tooltip"
                    >
                      <div className="floating-help-title">{processorTooltip.title}</div>
                      <div className="floating-help-text">{processorTooltip.description}</div>
                      <div className="floating-help-code">{processorTooltip.example}</div>
                    </div>
                  )}
                  {showSchemaModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Schema issues</h3>
                        {schemaError && <div className="error">Schema: {schemaError}</div>}
                        {!schemaError && !validator && (
                          <div className="error">Schema not available</div>
                        )}
                        {!schemaError && validator && jsonParseError && (
                          <div className="error">JSON: {jsonParseError}</div>
                        )}
                        {!schemaError && validator && !jsonParseError && validationErrors.length > 0 && (
                          <ul>
                            {validationErrors.map((err, idx) => (
                              <li key={`${err.path}-${idx}`}>
                                <span className="validation-path">{err.path}</span>
                                <span className="validation-message">{err.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowSchemaModal(false)}>
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {panelNavWarning.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Unsaved panel edits</h3>
                        <p>Please save or cancel the panel edits before navigating away.</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setPanelNavWarning((prev) => ({ ...prev, open: false }))}>
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {pendingNav && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Unsaved changes</h3>
                        <p>You have unsaved changes. Discard and navigate away?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setPendingNav(null)}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const action = pendingNav;
                              setPendingNav(null);
                              if (action) {
                                action();
                              }
                            }}
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {saveLoading && (
                    <div className="save-overlay" aria-live="polite" aria-busy="true">
                      <div className="save-overlay-card">
                        <div className="save-spinner" aria-hidden="true" />
                        <div>
                          <div className="save-overlay-title">Saving changes…</div>
                          <div className="save-overlay-subtitle">
                            Please wait{saveElapsed ? ` • ${saveElapsed}s` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {showAddFieldModal && addFieldContext && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        <h3>Add Event Field</h3>
                        <p>Select a field from the Events schema to add to this object.</p>
                        <input
                          type="text"
                          placeholder="Search fields"
                          value={addFieldSearch}
                          onChange={(e) => setAddFieldSearch(e.target.value)}
                        />
                        {eventsSchemaLoading && <div className="muted">Loading schema…</div>}
                        {eventsSchemaError && <div className="error">{eventsSchemaError}</div>}
                        {!eventsSchemaLoading && !eventsSchemaError && (
                          <div className="add-field-list">
                            {eventsSchemaFields
                              .filter((field) => field.toLowerCase().includes(addFieldSearch.toLowerCase()))
                              .map((field) => {
                                const existingFields = new Set([
                                  ...Object.keys(addFieldContext.obj?.event || {}),
                                  ...(panelAddedFields[addFieldContext.panelKey] || []),
                                ]);
                                const isReserved = reservedEventFields.has(field);
                                const isExisting = existingFields.has(field);
                                const description = getEventFieldDescription(field);
                                const titleParts = [
                                  ...(isReserved ? ['Reserved field'] : []),
                                  ...(isExisting ? ['Already present'] : []),
                                  ...(description ? [description] : []),
                                ];
                                return (
                                  <button
                                    key={field}
                                    type="button"
                                    className={isReserved || isExisting
                                      ? 'add-field-item add-field-item-disabled'
                                      : 'add-field-item'}
                                    onClick={() => {
                                      if (!isReserved && !isExisting) {
                                        addFieldToPanel(field);
                                      }
                                    }}
                                    disabled={isReserved || isExisting}
                                    title={titleParts.join(' • ')}
                                  >
                                    {field}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowAddFieldModal(false)}>
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {showPathModal && (
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="modal">
                  <h3>Tool Overview</h3>
                  <div className="help-section">
                    <h4>Current Path</h4>
                    <div className="path-row">
                      <div className="path-value monospace">{getCurrentPath()}</div>
                      <button
                        type="button"
                        className="copy-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(getCurrentPath());
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="path-note">
                      UA internal paths use an <span className="code-pill">id-core</span> prefix. The UI
                      displays the cleaned path for readability.
                    </p>
                  </div>
                  <div className="help-section">
                    <h4>Search modes</h4>
                    <ul>
                      <li><strong>Names</strong>: searches file and folder names (and paths).</li>
                      <li><strong>Content</strong>: searches inside file contents only.</li>
                      <li><strong>All</strong>: searches both names and contents.</li>
                    </ul>
                  </div>
                  <div className="index-status">
                    <div className="index-status-header">Search Index Status</div>
                    {searchRebuildPending || searchStatus?.isBuilding ? (
                      <span className="muted">Index rebuilding…</span>
                    ) : searchStatus?.lastBuiltAt ? (
                      <span className="muted">
                        Indexed {searchStatus.counts?.files || 0} files · Last refresh {formatTime(searchStatus.lastBuiltAt)}
                        {searchStatus?.nextRefreshAt
                          ? ` · Next refresh ${formatTime(searchStatus.nextRefreshAt)}`
                          : ''}
                      </span>
                    ) : (
                      <span className="muted">Index warming…</span>
                    )}
                    <div className="index-status-actions">
                      <button type="button" className="link-button" onClick={refreshSearchStatus}>
                        Refresh status
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={handleRebuildIndex}
                        disabled={searchStatus?.isBuilding}
                      >
                        Rebuild index
                      </button>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowPathModal(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {varModalOpen && (
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="modal modal-wide">
                  <h3>Trap variables {varModalToken ? `for ${varModalToken}` : ''}</h3>
                  {varModalMode === 'insert' && (
                    <p className="muted">Select a variable to insert.</p>
                  )}
                  {varModalVars.length === 0 ? (
                    <div className="empty-state">No trap variables available.</div>
                  ) : (
                    <div className="var-list" ref={varListRef}>
                      {varModalVars.map((variable: any, index: number) => {
                        const token = `$v${index + 1}`;
                        const isSelected = token === varModalToken;
                        return (
                        <div
                          className={`trap-var${isSelected ? ' trap-var-selected' : ''}${varModalMode === 'insert' ? ' trap-var-clickable' : ''}`}
                          key={variable?.name || variable?.oid || index}
                          ref={(el) => {
                            varRowRefs.current[token] = el;
                          }}
                          role={varModalMode === 'insert' ? 'button' : undefined}
                          tabIndex={varModalMode === 'insert' ? 0 : undefined}
                          onClick={() => {
                            if (varModalMode === 'insert') {
                              handleVarInsertSelect(token);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (varModalMode === 'insert' && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleVarInsertSelect(token);
                            }
                          }}
                        >
                          <div className="trap-var-title">
                            <span className="trap-var-name">{renderValue(variable?.name)}</span>
                            <span className={`pill${isSelected ? ' pill-selected' : ''}`}>{token}</span>
                            {variable?.valueType && <span className="pill">{variable.valueType}</span>}
                          </div>
                          <div className="trap-var-grid">
                            <div className="trap-var-col">
                              <div className="trap-var-row">
                                <span className="label">OID</span>
                                <span className="value monospace">{renderValue(variable?.oid)}</span>
                              </div>
                              <div className="trap-var-row">
                                <span className="label">Description</span>
                                <span className="value">{formatDescription(variable?.description)}</span>
                              </div>
                            </div>
                            <div className="trap-var-col">
                              {renderEnums(variable?.enums) || (
                                <span className="muted">No enums</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button type="button" onClick={() => {
                      setVarModalOpen(false);
                      setVarModalMode('view');
                      setVarInsertContext(null);
                    }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {eventFieldPickerOpen && (
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="modal modal-wide">
                  <h3>Event Fields</h3>
                  <input
                    type="text"
                    placeholder="Search event fields"
                    value={eventFieldSearch}
                    onChange={(e) => setEventFieldSearch(e.target.value)}
                  />
                  {eventsSchemaLoading && (
                    <div className="muted">Loading schema…</div>
                  )}
                  {!eventsSchemaLoading && eventsSchemaError && (
                    <div className="error">{eventsSchemaError}</div>
                  )}
                  {!eventsSchemaLoading && !eventsSchemaError && (
                    <div className="add-field-list">
                      {eventsSchemaFields
                        .filter((field) => field.toLowerCase().includes(eventFieldSearch.trim().toLowerCase()))
                        .map((field) => (
                          <button
                            type="button"
                            key={field}
                            className="add-field-item"
                            onClick={() => handleEventFieldInsertSelect(field)}
                            title={getEventFieldDescription(field)}
                          >
                            $.event.{field}
                          </button>
                        ))}
                      {eventsSchemaFields.length === 0 && (
                        <div className="empty-state">No schema fields loaded.</div>
                      )}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button type="button" onClick={() => {
                      setEventFieldPickerOpen(false);
                      setEventFieldInsertContext(null);
                    }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-screen">
          <div className="login-card">
            <h2>Sign in</h2>
            <form onSubmit={handleLogin} className="login-form">
              <label>
                Server
                <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
                  <option value="" disabled>
                    Select a server
                  </option>
                  {serverOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Auth type
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as 'basic' | 'certificate')}
                >
                  {authOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {authType === 'basic' ? (
                <>
                  <label>
                    Username
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Certificate path
                    <input
                      type="text"
                      value={certPath}
                      onChange={(e) => setCertPath(e.target.value)}
                    />
                  </label>
                  <label>
                    Key path
                    <input
                      type="text"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                    />
                  </label>
                  <label>
                    CA bundle path (optional)
                    <input
                      type="text"
                      value={caPath}
                      onChange={(e) => setCaPath(e.target.value)}
                    />
                  </label>
                </>
              )}

              {error && <div className="error">{error}</div>}
              <button type="submit" disabled={loading || !serverId}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
          </div>
        )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
