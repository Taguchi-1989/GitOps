import {
  BPMN_DOCUMENT_SCHEMA_VERSION,
  BPMN_MAX_INPUT_LENGTH,
  BPMN_STANDARD_VERSION,
  BpmnCollaboration,
  BpmnDocument,
  BpmnDocumentSchema,
  BpmnFlowNode,
  BpmnFlowNodeType,
  BpmnFlowNodeTypeSchema,
  BpmnLane,
  BpmnMessageFlow,
  BpmnParticipant,
  BpmnProcess,
  BpmnSequenceFlow,
} from './types';

export class BpmnMermaidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BpmnMermaidError';
  }
}

export interface BpmnMermaidImportResult {
  document: BpmnDocument;
  warnings: string[];
}

interface MermaidNode {
  id: string;
  label: string;
  className?: string;
}

interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  dotted: boolean;
}

interface NodeDirective {
  id: string;
  process: string;
  type: BpmnFlowNodeType;
  name?: string;
}

interface FlowDirective {
  id: string;
  process: string;
  source: string;
  target: string;
  condition?: string;
}

export function importBpmnMermaid(content: string): BpmnMermaidImportResult {
  if (!content.trim()) throw new BpmnMermaidError('Mermaid content is empty');
  if (content.length > BPMN_MAX_INPUT_LENGTH) {
    throw new BpmnMermaidError('Mermaid content exceeds the 5 MB input limit');
  }

  const lines = content.split(/\r?\n/);
  if (!lines.some(line => /^\s*(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/i.test(line))) {
    throw new BpmnMermaidError('A Mermaid flowchart/graph header is required');
  }

  const warnings: string[] = [];
  const mermaidNodes = new Map<string, MermaidNode>();
  const nodeDirectives = new Map<string, NodeDirective>();
  const processDirectives = new Map<string, Record<string, string>>();
  const collaborationDirectives = new Map<string, Record<string, string>>();
  const laneDirectives: Array<Record<string, string>> = [];
  const participantDirectives: Array<Record<string, string>> = [];
  const messageDirectives: Array<Record<string, string>> = [];
  const flowDirectives: FlowDirective[] = [];
  const edges: MermaidEdge[] = [];
  let definitionsId = 'Definitions_1';
  let targetNamespace = 'urn:flowops:bpmn:mermaid';

  for (const line of lines) {
    const directive = parseDirective(line);
    if (directive) {
      const { kind, attributes } = directive;
      if (kind === 'definitions') {
        definitionsId = toXmlId(attributes.id ?? definitionsId, 'Definitions_1');
        targetNamespace = attributes.namespace ?? targetNamespace;
      } else if (kind === 'process' && attributes.id) {
        processDirectives.set(toXmlId(attributes.id, 'Process_1'), attributes);
      } else if (kind === 'node' && attributes.id) {
        const type = BpmnFlowNodeTypeSchema.safeParse(attributes.type ?? 'task');
        if (!type.success) {
          throw new BpmnMermaidError(
            `Unsupported bpmn:node type "${attributes.type}" for "${attributes.id}"`
          );
        }
        nodeDirectives.set(attributes.id, {
          id: toXmlId(attributes.id, 'Node_1'),
          process: toXmlId(attributes.process ?? 'Process_1', 'Process_1'),
          type: type.data,
          ...(attributes.name ? { name: attributes.name } : {}),
        });
      } else if (kind === 'flow' && attributes.id) {
        if (!attributes.source || !attributes.target) {
          throw new BpmnMermaidError(`bpmn:flow "${attributes.id}" requires source and target`);
        }
        flowDirectives.push({
          id: toXmlId(attributes.id, 'Flow_1'),
          process: toXmlId(attributes.process ?? 'Process_1', 'Process_1'),
          source: toXmlId(attributes.source, 'Source_1'),
          target: toXmlId(attributes.target, 'Target_1'),
          ...(attributes.condition ? { condition: attributes.condition } : {}),
        });
      } else if (kind === 'collaboration' && attributes.id) {
        collaborationDirectives.set(toXmlId(attributes.id, 'Collaboration_1'), attributes);
      } else if (kind === 'lane') {
        laneDirectives.push(attributes);
      } else if (kind === 'participant') {
        participantDirectives.push(attributes);
      } else if (kind === 'message') {
        messageDirectives.push(attributes);
      }
      continue;
    }

    const edge = parseEdge(line);
    if (edge) {
      edges.push(edge);
      continue;
    }
    const node = parseNode(line);
    if (node) mermaidNodes.set(node.id, node);
  }

  for (const edge of edges) {
    if (!mermaidNodes.has(edge.from)) {
      mermaidNodes.set(edge.from, { id: edge.from, label: edge.from });
    }
    if (!mermaidNodes.has(edge.to)) mermaidNodes.set(edge.to, { id: edge.to, label: edge.to });
  }
  if (mermaidNodes.size === 0 && nodeDirectives.size === 0) {
    throw new BpmnMermaidError('No Mermaid nodes were found');
  }

  if (processDirectives.size === 0) {
    processDirectives.set('Process_1', {
      id: 'Process_1',
      name: 'Mermaid process',
      executable: 'false',
    });
  }

  const processes = new Map<string, BpmnProcess>();
  for (const [processId, attributes] of processDirectives) {
    processes.set(processId, {
      id: processId,
      ...(attributes.name ? { name: attributes.name } : {}),
      isExecutable: attributes.executable === 'true',
      nodes: {},
      sequenceFlows: {},
      lanes: {},
    });
  }
  const defaultProcessId = processes.keys().next().value as string;

  for (const mermaidNode of mermaidNodes.values()) {
    if (participantDirectives.some(item => item.id === mermaidNode.id)) continue;
    const directive = nodeDirectives.get(mermaidNode.id);
    const nodeId = toXmlId(directive?.id ?? mermaidNode.id, 'Node_1');
    const processId = directive?.process ?? defaultProcessId;
    const process = processes.get(processId);
    if (!process) {
      throw new BpmnMermaidError(`Node "${nodeId}" references unknown process "${processId}"`);
    }
    const type = directive?.type ?? classToBpmnType(mermaidNode.className);
    process.nodes[nodeId] = {
      id: nodeId,
      type,
      name: directive?.name ?? mermaidNode.label,
      eventDefinitions: [],
    };
  }

  for (const directive of nodeDirectives.values()) {
    const process = processes.get(directive.process);
    if (!process) {
      throw new BpmnMermaidError(
        `Node "${directive.id}" references unknown process "${directive.process}"`
      );
    }
    if (!process.nodes[directive.id]) {
      process.nodes[directive.id] = {
        id: directive.id,
        type: directive.type,
        name: directive.name ?? directive.id,
        eventDefinitions: [],
      };
    }
  }

  const availableFlows = [...flowDirectives];
  let generatedFlow = 0;
  for (const edge of edges) {
    const sourceId = toXmlId(edge.from, 'Source_1');
    const targetId = toXmlId(edge.to, 'Target_1');
    const sourceProcess = [...processes.values()].find(process => process.nodes[sourceId]);
    const targetProcess = [...processes.values()].find(process => process.nodes[targetId]);
    const annotatedMessage = messageDirectives.some(
      item => item.source === sourceId && item.target === targetId
    );
    if (edge.dotted && annotatedMessage) continue;
    if (!sourceProcess || !targetProcess || sourceProcess.id !== targetProcess.id) {
      throw new BpmnMermaidError(
        `Sequence edge "${sourceId} -> ${targetId}" must stay inside one BPMN process`
      );
    }
    const directiveIndex = availableFlows.findIndex(
      item =>
        item.process === sourceProcess.id && item.source === sourceId && item.target === targetId
    );
    const directive = directiveIndex >= 0 ? availableFlows.splice(directiveIndex, 1)[0] : undefined;
    generatedFlow += 1;
    const id = uniqueId(
      directive?.id ?? `Flow_${String(generatedFlow).padStart(3, '0')}`,
      sourceProcess.sequenceFlows
    );
    sourceProcess.sequenceFlows[id] = {
      id,
      sourceRef: sourceId,
      targetRef: targetId,
      ...(edge.label ? { name: edge.label } : {}),
      ...(directive?.condition ? { conditionExpression: directive.condition } : {}),
    };
  }

  for (const directive of availableFlows) {
    const process = processes.get(directive.process);
    if (!process?.nodes[directive.source] || !process.nodes[directive.target]) {
      throw new BpmnMermaidError(
        `Flow "${directive.id}" references missing nodes in process "${directive.process}"`
      );
    }
    process.sequenceFlows[directive.id] = {
      id: directive.id,
      sourceRef: directive.source,
      targetRef: directive.target,
      ...(directive.condition ? { conditionExpression: directive.condition } : {}),
    };
  }

  for (const attributes of laneDirectives) {
    const process = processes.get(attributes.process ?? defaultProcessId);
    if (!process || !attributes.id) continue;
    const id = toXmlId(attributes.id, 'Lane_1');
    const lane: BpmnLane = {
      id,
      ...(attributes.name ? { name: attributes.name } : {}),
      flowNodeRefs: (attributes.nodes ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map(item => toXmlId(item, 'Node_1')),
    };
    process.lanes[id] = lane;
    for (const nodeRef of lane.flowNodeRefs) {
      if (process.nodes[nodeRef]) process.nodes[nodeRef].laneId = id;
    }
  }

  const collaborations = buildCollaborations(
    collaborationDirectives,
    participantDirectives,
    messageDirectives
  );
  const document = BpmnDocumentSchema.parse({
    schemaVersion: BPMN_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'BPMN', version: BPMN_STANDARD_VERSION, serialization: 'BPMN_XML' },
    profile: 'flowops-conceptual',
    definitions: {
      id: definitionsId,
      targetNamespace,
      exporter: 'FlowOps',
      exporterVersion: 'flowops-bpmn.v1',
    },
    processes: [...processes.values()],
    globalElements: [],
    collaborations,
    diagrams: [],
    metadata: { sourceFormat: 'mermaid', conversionProfile: 'conceptual-control-flow' },
  });
  warnings.push(
    'Mermaid preserves core BPMN control flow only. Execution attributes, event payloads, data associations, choreography, and vendor extensions require BPMN-aware review.'
  );
  return { document, warnings };
}

export function exportBpmnMermaid(document: BpmnDocument): string {
  const lines = [
    'flowchart LR',
    `  %% bpmn:definitions id="${escapeDirective(document.definitions.id)}" namespace="${escapeDirective(document.definitions.targetNamespace)}"`,
  ];

  for (const process of document.processes) {
    lines.push(
      `  %% bpmn:process id="${process.id}" name="${escapeDirective(process.name ?? process.id)}" executable="${process.isExecutable}"`
    );
    lines.push(`  subgraph ${process.id}["${escapeMermaid(process.name ?? process.id)}"]`);
    for (const node of Object.values(process.nodes)) {
      lines.push(`    ${renderNode(node)}`);
      lines.push(
        `    %% bpmn:node id="${node.id}" process="${process.id}" type="${node.type}" name="${escapeDirective(node.name ?? node.id)}"`
      );
    }
    for (const flow of Object.values(process.sequenceFlows)) {
      const label = flow.name ?? flow.conditionExpression;
      lines.push(
        `    ${flow.sourceRef} -->${label ? `|"${escapeMermaid(label)}"| ` : ' '}${flow.targetRef}`
      );
      lines.push(
        `    %% bpmn:flow id="${flow.id}" process="${process.id}" source="${flow.sourceRef}" target="${flow.targetRef}"${flow.conditionExpression ? ` condition="${escapeDirective(flow.conditionExpression)}"` : ''}`
      );
    }
    for (const lane of Object.values(process.lanes)) {
      lines.push(
        `    %% bpmn:lane id="${lane.id}" process="${process.id}" name="${escapeDirective(lane.name ?? lane.id)}" nodes="${lane.flowNodeRefs.join(' ')}"`
      );
    }
    lines.push('  end');
  }

  for (const collaboration of document.collaborations) {
    lines.push(
      `  %% bpmn:collaboration id="${collaboration.id}" name="${escapeDirective(collaboration.name ?? collaboration.id)}"`
    );
    for (const participant of Object.values(collaboration.participants)) {
      lines.push(
        `  ${participant.id}["${escapeMermaid(participant.name ?? participant.id)}"]:::bpmnParticipant`
      );
      lines.push(
        `  %% bpmn:participant id="${participant.id}" collaboration="${collaboration.id}" name="${escapeDirective(participant.name ?? participant.id)}"${participant.processRef ? ` process="${participant.processRef}"` : ''}`
      );
    }
    for (const message of Object.values(collaboration.messageFlows)) {
      lines.push(
        `  ${message.sourceRef} -.->${message.name ? `|"${escapeMermaid(message.name)}"| ` : ' '}${message.targetRef}`
      );
      lines.push(
        `  %% bpmn:message id="${message.id}" collaboration="${collaboration.id}" source="${message.sourceRef}" target="${message.targetRef}" name="${escapeDirective(message.name ?? '')}"`
      );
    }
  }

  lines.push('  classDef bpmnStart fill:#dcfce7,stroke:#16a34a,color:#14532d');
  lines.push('  classDef bpmnEnd fill:#fee2e2,stroke:#dc2626,color:#7f1d1d');
  lines.push('  classDef bpmnTask fill:#dbeafe,stroke:#2563eb,color:#1e3a8a');
  lines.push('  classDef bpmnGateway fill:#fef3c7,stroke:#d97706,color:#78350f');
  lines.push('  classDef bpmnParticipant fill:#ede9fe,stroke:#7c3aed,color:#4c1d95');
  return lines.join('\n');
}

function buildCollaborations(
  collaborationDirectives: Map<string, Record<string, string>>,
  participantDirectives: Array<Record<string, string>>,
  messageDirectives: Array<Record<string, string>>
): BpmnCollaboration[] {
  if (
    collaborationDirectives.size === 0 &&
    participantDirectives.length === 0 &&
    messageDirectives.length === 0
  ) {
    return [];
  }
  if (collaborationDirectives.size === 0) {
    collaborationDirectives.set('Collaboration_1', { id: 'Collaboration_1' });
  }
  const collaborations = new Map<string, BpmnCollaboration>();
  for (const [id, attributes] of collaborationDirectives) {
    collaborations.set(id, {
      id,
      ...(attributes.name ? { name: attributes.name } : {}),
      participants: {},
      messageFlows: {},
    });
  }
  const defaultId = collaborations.keys().next().value as string;
  for (const attributes of participantDirectives) {
    if (!attributes.id) continue;
    const collaboration = collaborations.get(attributes.collaboration ?? defaultId);
    if (!collaboration) continue;
    const id = toXmlId(attributes.id, 'Participant_1');
    const participant: BpmnParticipant = {
      id,
      ...(attributes.name ? { name: attributes.name } : {}),
      ...(attributes.process ? { processRef: toXmlId(attributes.process, 'Process_1') } : {}),
    };
    collaboration.participants[id] = participant;
  }
  for (const attributes of messageDirectives) {
    if (!attributes.id || !attributes.source || !attributes.target) continue;
    const collaboration = collaborations.get(attributes.collaboration ?? defaultId);
    if (!collaboration) continue;
    const id = toXmlId(attributes.id, 'MessageFlow_1');
    const message: BpmnMessageFlow = {
      id,
      sourceRef: toXmlId(attributes.source, 'Source_1'),
      targetRef: toXmlId(attributes.target, 'Target_1'),
      ...(attributes.name ? { name: attributes.name } : {}),
    };
    collaboration.messageFlows[id] = message;
  }
  return [...collaborations.values()];
}

function parseDirective(line: string): { kind: string; attributes: Record<string, string> } | null {
  const match = line.match(
    /^\s*%%\s*bpmn:(definitions|process|node|flow|collaboration|lane|participant|message)\s+(.+)$/i
  );
  if (!match) return null;
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z][A-Za-z0-9_-]*)="((?:[^"\\]|\\.)*)"/g;
  for (const item of match[2].matchAll(attributePattern)) {
    attributes[item[1]] = item[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return { kind: match[1].toLowerCase(), attributes };
}

function parseNode(line: string): MermaidNode | null {
  if (
    /^\s*(?:flowchart|graph|classDef|class|linkStyle|style|subgraph|end)\b/i.test(line) ||
    /^\s*%%/.test(line)
  ) {
    return null;
  }
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*([\[({].*)$/);
  if (!match) return null;
  const rest = match[2];
  const quoted = rest.match(/"((?:[^"\\]|\\.)*)"/);
  const rawLabel =
    quoted?.[1] ??
    rest.replace(/:::[A-Za-z_][A-Za-z0-9_-]*\s*$/, '').replace(/^[\[({]+|[\])}]+$/g, '');
  const className = rest.match(/:::([A-Za-z_][A-Za-z0-9_-]*)/)?.[1];
  return {
    id: match[1],
    label:
      rawLabel
        .replace(/<br\s*\/?\s*>/gi, ' / ')
        .replace(/#quot;/g, '"')
        .trim() || match[1],
    className,
  };
}

function parseEdge(line: string): MermaidEdge | null {
  const match = line.match(
    /^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*(-->|-\.->|==>)\s*(?:\|"?([^|"]+)"?\|\s*)?([A-Za-z_][A-Za-z0-9_.-]*)\s*$/
  );
  if (!match) return null;
  return {
    from: match[1],
    to: match[4],
    dotted: match[2] === '-.->',
    ...(match[3]?.trim() ? { label: match[3].trim() } : {}),
  };
}

function classToBpmnType(className?: string): BpmnFlowNodeType {
  const candidate = className?.toLowerCase();
  const mapping: Record<string, BpmnFlowNodeType> = {
    start: 'startEvent',
    bpmnstart: 'startEvent',
    end: 'endEvent',
    bpmnend: 'endEvent',
    event: 'intermediateCatchEvent',
    gateway: 'exclusiveGateway',
    bpmngateway: 'exclusiveGateway',
    exclusive: 'exclusiveGateway',
    parallel: 'parallelGateway',
    inclusive: 'inclusiveGateway',
    user: 'userTask',
    service: 'serviceTask',
    manual: 'manualTask',
    script: 'scriptTask',
    businessrule: 'businessRuleTask',
    send: 'sendTask',
    receive: 'receiveTask',
    subprocess: 'subProcess',
    callactivity: 'callActivity',
    task: 'task',
    bpmntask: 'task',
  };
  return (candidate && mapping[candidate]) || 'task';
}

function renderNode(node: BpmnFlowNode): string {
  const label = escapeMermaid(node.name ?? node.id);
  if (node.type === 'startEvent') return `${node.id}(("${label}")):::bpmnStart`;
  if (node.type === 'endEvent') return `${node.id}(("${label}")):::bpmnEnd`;
  if (node.type.endsWith('Gateway')) return `${node.id}{"${label}"}:::bpmnGateway`;
  if (['subProcess', 'transaction'].includes(node.type)) {
    return `${node.id}[["${label}"]]:::bpmnTask`;
  }
  return `${node.id}["${label}"]:::bpmnTask`;
}

function uniqueId(base: string, values: Record<string, unknown>): string {
  if (!values[base]) return base;
  let suffix = 2;
  while (values[`${base}_${suffix}`]) suffix += 1;
  return `${base}_${suffix}`;
}

function toXmlId(value: string, fallback: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/_+/g, '_');
  const withStart = /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
  return withStart || fallback;
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ');
}

function escapeDirective(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ');
}
