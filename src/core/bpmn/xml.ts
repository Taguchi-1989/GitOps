import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  BPMN_DOCUMENT_SCHEMA_VERSION,
  BPMN_MAX_INPUT_LENGTH,
  BPMN_STANDARD_VERSION,
  BpmnCollaboration,
  BpmnDiagram,
  BpmnDocument,
  BpmnDocumentSchema,
  BpmnEventDefinition,
  BpmnFlowNode,
  BpmnFlowNodeType,
  BpmnGlobalElement,
  BpmnLane,
  BpmnProcess,
  BpmnSequenceFlow,
} from './types';
import { validateBpmnDocument } from './validate';

type XmlNode = Record<string, unknown>;

export class BpmnXmlError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'BpmnXmlError';
  }
}

export interface BpmnXmlImportResult {
  document: BpmnDocument;
  warnings: string[];
}

const BPMN_MODEL_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMN_DI_NAMESPACE = 'http://www.omg.org/spec/BPMN/20100524/DI';
const OMG_DC_NAMESPACE = 'http://www.omg.org/spec/DD/20100524/DC';
const OMG_DI_NAMESPACE = 'http://www.omg.org/spec/DD/20100524/DI';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';

const FLOW_NODE_TYPES: BpmnFlowNodeType[] = [
  'startEvent',
  'endEvent',
  'intermediateCatchEvent',
  'intermediateThrowEvent',
  'boundaryEvent',
  'task',
  'userTask',
  'serviceTask',
  'manualTask',
  'scriptTask',
  'businessRuleTask',
  'sendTask',
  'receiveTask',
  'subProcess',
  'transaction',
  'callActivity',
  'exclusiveGateway',
  'parallelGateway',
  'inclusiveGateway',
  'eventBasedGateway',
  'complexGateway',
];

const EVENT_DEFINITION_TAGS: Record<string, BpmnEventDefinition['type']> = {
  cancelEventDefinition: 'cancel',
  compensateEventDefinition: 'compensate',
  conditionalEventDefinition: 'conditional',
  errorEventDefinition: 'error',
  escalationEventDefinition: 'escalation',
  linkEventDefinition: 'link',
  messageEventDefinition: 'message',
  signalEventDefinition: 'signal',
  terminateEventDefinition: 'terminate',
  timerEventDefinition: 'timer',
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: false,
  allowBooleanAttributes: false,
  maxNestedTags: 300,
  isArray: name =>
    [
      ...FLOW_NODE_TYPES,
      'process',
      'sequenceFlow',
      'collaboration',
      'participant',
      'messageFlow',
      'laneSet',
      'lane',
      'flowNodeRef',
      'BPMNDiagram',
      'BPMNShape',
      'BPMNEdge',
      'waypoint',
      'documentation',
      'message',
      'signal',
      'error',
      'escalation',
      ...Object.keys(EVENT_DEFINITION_TAGS),
    ].includes(name),
});

export function importBpmnXml(xml: string): BpmnXmlImportResult {
  if (!xml.trim()) throw new BpmnXmlError('EMPTY_XML', 'BPMN XML is empty');
  if (xml.length > BPMN_MAX_INPUT_LENGTH) {
    throw new BpmnXmlError('XML_TOO_LARGE', 'BPMN XML exceeds the 5 MB input limit');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new BpmnXmlError('DTD_NOT_ALLOWED', 'DTD and entity declarations are not allowed');
  }

  const xmlValidation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (xmlValidation !== true) {
    throw new BpmnXmlError(
      'XML_NOT_WELL_FORMED',
      `XML is not well formed: ${xmlValidation.err.msg} at line ${xmlValidation.err.line}`
    );
  }

  let parsed: XmlNode;
  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    throw new BpmnXmlError(
      'XML_PARSE_FAILED',
      error instanceof Error ? error.message : 'Failed to parse BPMN XML'
    );
  }
  const definitions = asNode(parsed.definitions);
  if (!definitions) {
    throw new BpmnXmlError(
      'DEFINITIONS_ROOT_REQUIRED',
      'BPMN 2.0 XML requires a bpmn:definitions root'
    );
  }

  const warnings: string[] = [];
  const extensionCount = xml.match(/<(?:[A-Za-z_][\w.-]*:)?extensionElements\b/g)?.length ?? 0;
  if (extensionCount > 0) {
    warnings.push(
      `${extensionCount} extensionElements block(s) were detected. Vendor-specific execution extensions are not preserved by the core profile.`
    );
  }
  const unsupported = detectUnsupportedElements(xml);
  if (unsupported.length > 0) {
    warnings.push(`Unsupported BPMN elements were omitted: ${unsupported.join(', ')}.`);
  }

  const processes = asArray(definitions.process).map(node => parseProcess(node, warnings));
  if (processes.length === 0) {
    throw new BpmnXmlError('PROCESS_REQUIRED', 'At least one BPMN process is required');
  }

  const rawDocument = {
    schemaVersion: BPMN_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'BPMN', version: BPMN_STANDARD_VERSION, serialization: 'BPMN_XML' },
    profile: 'bpmn-2.0-core',
    definitions: {
      id: attribute(definitions, 'id') ?? 'Definitions_1',
      targetNamespace: attribute(definitions, 'targetNamespace') ?? 'urn:flowops:bpmn:imported',
      ...(attribute(definitions, 'exporter')
        ? { exporter: attribute(definitions, 'exporter') }
        : {}),
      ...(attribute(definitions, 'exporterVersion')
        ? { exporterVersion: attribute(definitions, 'exporterVersion') }
        : {}),
    },
    processes,
    globalElements: parseGlobalElements(definitions),
    collaborations: asArray(definitions.collaboration).map(parseCollaboration),
    diagrams: asArray(definitions.BPMNDiagram).map(parseDiagram),
    metadata: { sourceFormat: 'bpmn-xml-2.0' },
  };
  const parsedDocument = BpmnDocumentSchema.safeParse(rawDocument);
  if (!parsedDocument.success) {
    throw new BpmnXmlError(
      'BPMN_DOCUMENT_SCHEMA_INVALID',
      parsedDocument.error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')
    );
  }
  const validation = validateBpmnDocument(parsedDocument.data);
  warnings.push(...validation.warnings.map(item => item.message));
  if (!validation.valid) {
    throw new BpmnXmlError(
      'BPMN_DOCUMENT_INVALID',
      validation.errors.map(item => item.message).join('; ')
    );
  }
  return { document: parsedDocument.data, warnings: unique(warnings) };
}

export function exportBpmnXml(input: unknown): string {
  const document = BpmnDocumentSchema.parse(input);
  const validation = validateBpmnDocument(document);
  if (!validation.valid) {
    throw new BpmnXmlError(
      'BPMN_DOCUMENT_INVALID',
      validation.errors.map(item => item.message).join('; ')
    );
  }

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(
    `<bpmn:definitions xmlns:bpmn="${BPMN_MODEL_NAMESPACE}" xmlns:bpmndi="${BPMN_DI_NAMESPACE}" xmlns:dc="${OMG_DC_NAMESPACE}" xmlns:di="${OMG_DI_NAMESPACE}" xmlns:xsi="${XSI_NAMESPACE}" id="${escapeAttribute(document.definitions.id)}" targetNamespace="${escapeAttribute(document.definitions.targetNamespace)}" exporter="${escapeAttribute(document.definitions.exporter ?? 'FlowOps')}" exporterVersion="${escapeAttribute(document.definitions.exporterVersion ?? 'flowops-bpmn.v1')}">`
  );

  for (const global of document.globalElements) renderGlobalElement(global, lines);
  for (const process of document.processes) renderProcess(process, lines);
  for (const collaboration of document.collaborations) renderCollaboration(collaboration, lines);

  const diagrams = document.diagrams.length > 0 ? document.diagrams : generateDiagrams(document);
  for (const diagram of diagrams) renderDiagram(diagram, lines);
  lines.push('</bpmn:definitions>');
  return `${lines.join('\n')}\n`;
}

function parseProcess(node: XmlNode, warnings: string[]): BpmnProcess {
  const processId = requiredAttribute(node, 'id', 'process');
  const process: BpmnProcess = {
    id: processId,
    ...(attribute(node, 'name') ? { name: attribute(node, 'name') } : {}),
    isExecutable: parseBoolean(attribute(node, 'isExecutable'), false),
    ...(parseProcessType(attribute(node, 'processType'))
      ? { processType: parseProcessType(attribute(node, 'processType')) }
      : {}),
    ...(documentation(node) ? { documentation: documentation(node) } : {}),
    nodes: {},
    sequenceFlows: {},
    lanes: {},
  };

  const parseContainer = (container: XmlNode, parentSubProcessId?: string): void => {
    for (const type of FLOW_NODE_TYPES) {
      for (const flowNodeXml of asArray(container[type])) {
        const id = requiredAttribute(flowNodeXml, 'id', type);
        if (process.nodes[id]) {
          throw new BpmnXmlError('DUPLICATE_ID', `Duplicate BPMN node id "${id}"`);
        }
        const flowNode: BpmnFlowNode = {
          id,
          type,
          ...(attribute(flowNodeXml, 'name') ? { name: attribute(flowNodeXml, 'name') } : {}),
          ...(documentation(flowNodeXml) ? { documentation: documentation(flowNodeXml) } : {}),
          ...(parentSubProcessId ? { parentSubProcessId } : {}),
          ...(attribute(flowNodeXml, 'default')
            ? { defaultFlow: attribute(flowNodeXml, 'default') }
            : {}),
          ...(attribute(flowNodeXml, 'attachedToRef')
            ? { attachedToRef: attribute(flowNodeXml, 'attachedToRef') }
            : {}),
          ...(attribute(flowNodeXml, 'cancelActivity') !== undefined
            ? { cancelActivity: parseBoolean(attribute(flowNodeXml, 'cancelActivity'), true) }
            : {}),
          ...(attribute(flowNodeXml, 'calledElement')
            ? { calledElement: attribute(flowNodeXml, 'calledElement') }
            : {}),
          ...(attribute(flowNodeXml, 'triggeredByEvent') !== undefined
            ? {
                triggeredByEvent: parseBoolean(attribute(flowNodeXml, 'triggeredByEvent'), false),
              }
            : {}),
          eventDefinitions: parseEventDefinitions(flowNodeXml),
        };
        process.nodes[id] = flowNode;
        if (type === 'subProcess' || type === 'transaction') parseContainer(flowNodeXml, id);
      }
    }

    for (const flowXml of asArray(container.sequenceFlow)) {
      const id = requiredAttribute(flowXml, 'id', 'sequenceFlow');
      if (process.sequenceFlows[id]) {
        throw new BpmnXmlError('DUPLICATE_ID', `Duplicate BPMN sequence-flow id "${id}"`);
      }
      const sourceRef = requiredAttribute(flowXml, 'sourceRef', `sequenceFlow "${id}"`);
      const targetRef = requiredAttribute(flowXml, 'targetRef', `sequenceFlow "${id}"`);
      const condition = textValue(flowXml.conditionExpression);
      const flow: BpmnSequenceFlow = {
        id,
        sourceRef,
        targetRef,
        ...(attribute(flowXml, 'name') ? { name: attribute(flowXml, 'name') } : {}),
        ...(documentation(flowXml) ? { documentation: documentation(flowXml) } : {}),
        ...(condition !== undefined ? { conditionExpression: condition } : {}),
        ...(attribute(flowXml, 'isImmediate') !== undefined
          ? { isImmediate: parseBoolean(attribute(flowXml, 'isImmediate'), false) }
          : {}),
        ...(parentSubProcessId ? { parentSubProcessId } : {}),
      };
      process.sequenceFlows[id] = flow;
    }
  };

  parseContainer(node);
  for (const laneSet of asArray(node.laneSet)) parseLaneSet(laneSet, process);
  for (const lane of Object.values(process.lanes)) {
    for (const nodeRef of lane.flowNodeRefs) {
      if (process.nodes[nodeRef]) process.nodes[nodeRef].laneId = lane.id;
    }
  }
  if (Object.keys(process.nodes).length === 0) {
    warnings.push(`Process "${process.id}" contains no supported flow nodes.`);
  }
  return process;
}

function parseLaneSet(laneSet: XmlNode, process: BpmnProcess, parentLaneId?: string): void {
  for (const laneXml of asArray(laneSet.lane)) {
    const id = requiredAttribute(laneXml, 'id', 'lane');
    const lane: BpmnLane = {
      id,
      ...(attribute(laneXml, 'name') ? { name: attribute(laneXml, 'name') } : {}),
      ...(parentLaneId ? { parentLaneId } : {}),
      flowNodeRefs: asArray(laneXml.flowNodeRef)
        .map(textValue)
        .filter((value): value is string => Boolean(value)),
    };
    process.lanes[id] = lane;
    for (const child of asArray(laneXml.childLaneSet)) parseLaneSet(child, process, id);
  }
}

function parseEventDefinitions(node: XmlNode): BpmnEventDefinition[] {
  const definitions: BpmnEventDefinition[] = [];
  for (const [tag, type] of Object.entries(EVENT_DEFINITION_TAGS)) {
    for (const definitionXml of asArray(node[tag])) {
      const referenceAttribute: Record<BpmnEventDefinition['type'], string | undefined> = {
        cancel: undefined,
        compensate: 'activityRef',
        conditional: undefined,
        error: 'errorRef',
        escalation: 'escalationRef',
        link: 'name',
        message: 'messageRef',
        signal: 'signalRef',
        terminate: undefined,
        timer: undefined,
      };
      const expressionEntries: Array<[BpmnEventDefinition['expressionKind'], unknown]> = [
        ['condition', definitionXml.condition],
        ['timeDate', definitionXml.timeDate],
        ['timeDuration', definitionXml.timeDuration],
        ['timeCycle', definitionXml.timeCycle],
      ];
      const expression = expressionEntries.find(([, value]) => value !== undefined);
      const referenceName = referenceAttribute[type];
      definitions.push({
        type,
        ...(referenceName && attribute(definitionXml, referenceName)
          ? { reference: attribute(definitionXml, referenceName) }
          : {}),
        ...(expression
          ? {
              expressionKind: expression[0],
              expression: textValue(expression[1]) ?? '',
            }
          : {}),
      });
    }
  }
  return definitions;
}

function parseGlobalElements(definitions: XmlNode): BpmnGlobalElement[] {
  const result: BpmnGlobalElement[] = [];
  for (const type of ['message', 'signal', 'error', 'escalation'] as const) {
    for (const node of asArray(definitions[type])) {
      const id = requiredAttribute(node, 'id', type);
      const attributes: Record<string, string> = {};
      for (const [key, value] of Object.entries(node)) {
        if (
          !key.startsWith('@_') ||
          ['@_id', '@_name'].includes(key) ||
          typeof value !== 'string'
        ) {
          continue;
        }
        attributes[key.slice(2)] = value;
      }
      result.push({
        id,
        type,
        ...(attribute(node, 'name') ? { name: attribute(node, 'name') } : {}),
        attributes,
      });
    }
  }
  return result;
}

function parseCollaboration(node: XmlNode): BpmnCollaboration {
  const collaboration: BpmnCollaboration = {
    id: requiredAttribute(node, 'id', 'collaboration'),
    ...(attribute(node, 'name') ? { name: attribute(node, 'name') } : {}),
    participants: {},
    messageFlows: {},
  };
  for (const participantXml of asArray(node.participant)) {
    const id = requiredAttribute(participantXml, 'id', 'participant');
    collaboration.participants[id] = {
      id,
      ...(attribute(participantXml, 'name') ? { name: attribute(participantXml, 'name') } : {}),
      ...(attribute(participantXml, 'processRef')
        ? { processRef: attribute(participantXml, 'processRef') }
        : {}),
    };
  }
  for (const flowXml of asArray(node.messageFlow)) {
    const id = requiredAttribute(flowXml, 'id', 'messageFlow');
    collaboration.messageFlows[id] = {
      id,
      sourceRef: requiredAttribute(flowXml, 'sourceRef', `messageFlow "${id}"`),
      targetRef: requiredAttribute(flowXml, 'targetRef', `messageFlow "${id}"`),
      ...(attribute(flowXml, 'name') ? { name: attribute(flowXml, 'name') } : {}),
      ...(attribute(flowXml, 'messageRef') ? { messageRef: attribute(flowXml, 'messageRef') } : {}),
    };
  }
  return collaboration;
}

function parseDiagram(node: XmlNode): BpmnDiagram {
  const plane = asNode(asArray(node.BPMNPlane)[0]);
  if (!plane) throw new BpmnXmlError('BPMN_PLANE_REQUIRED', 'BPMNDiagram requires BPMNPlane');
  return {
    id: requiredAttribute(node, 'id', 'BPMNDiagram'),
    ...(attribute(node, 'name') ? { name: attribute(node, 'name') } : {}),
    planeId: requiredAttribute(plane, 'id', 'BPMNPlane'),
    planeElement: requiredAttribute(plane, 'bpmnElement', 'BPMNPlane'),
    shapes: asArray(plane.BPMNShape).map(shape => {
      const bounds = asNode(asArray(shape.Bounds)[0]);
      if (!bounds) throw new BpmnXmlError('BOUNDS_REQUIRED', 'BPMNShape requires dc:Bounds');
      return {
        id: requiredAttribute(shape, 'id', 'BPMNShape'),
        bpmnElement: requiredAttribute(shape, 'bpmnElement', 'BPMNShape'),
        bounds: {
          x: numberAttribute(bounds, 'x'),
          y: numberAttribute(bounds, 'y'),
          width: numberAttribute(bounds, 'width'),
          height: numberAttribute(bounds, 'height'),
        },
        ...(attribute(shape, 'isHorizontal') !== undefined
          ? { isHorizontal: parseBoolean(attribute(shape, 'isHorizontal'), false) }
          : {}),
      };
    }),
    edges: asArray(plane.BPMNEdge).map(edge => ({
      id: requiredAttribute(edge, 'id', 'BPMNEdge'),
      bpmnElement: requiredAttribute(edge, 'bpmnElement', 'BPMNEdge'),
      waypoints: asArray(edge.waypoint).map(waypoint => ({
        x: numberAttribute(waypoint, 'x'),
        y: numberAttribute(waypoint, 'y'),
      })),
    })),
  };
}

function renderGlobalElement(global: BpmnGlobalElement, lines: string[]): void {
  const attributes = Object.entries(global.attributes)
    .filter(([name]) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name))
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
  lines.push(
    `  <bpmn:${global.type} id="${escapeAttribute(global.id)}"${global.name ? ` name="${escapeAttribute(global.name)}"` : ''}${attributes}/>`
  );
}

function renderProcess(process: BpmnProcess, lines: string[]): void {
  lines.push(
    `  <bpmn:process id="${escapeAttribute(process.id)}"${process.name ? ` name="${escapeAttribute(process.name)}"` : ''} isExecutable="${process.isExecutable}"${process.processType ? ` processType="${process.processType}"` : ''}>`
  );
  if (process.documentation) {
    lines.push(`    <bpmn:documentation>${escapeText(process.documentation)}</bpmn:documentation>`);
  }
  renderLaneSets(process, lines);
  renderContainer(process, undefined, lines, 2);
  lines.push('  </bpmn:process>');
}

function renderLaneSets(process: BpmnProcess, lines: string[]): void {
  const rootLanes = Object.values(process.lanes).filter(lane => !lane.parentLaneId);
  if (rootLanes.length === 0) return;
  lines.push(`    <bpmn:laneSet id="LaneSet_${escapeAttribute(process.id)}">`);
  for (const lane of rootLanes) renderLane(lane, process, lines, 3);
  lines.push('    </bpmn:laneSet>');
}

function renderLane(lane: BpmnLane, process: BpmnProcess, lines: string[], depth: number): void {
  const indent = '  '.repeat(depth);
  const children = Object.values(process.lanes).filter(item => item.parentLaneId === lane.id);
  lines.push(
    `${indent}<bpmn:lane id="${escapeAttribute(lane.id)}"${lane.name ? ` name="${escapeAttribute(lane.name)}"` : ''}>`
  );
  for (const nodeRef of lane.flowNodeRefs) {
    lines.push(`${indent}  <bpmn:flowNodeRef>${escapeText(nodeRef)}</bpmn:flowNodeRef>`);
  }
  if (children.length > 0) {
    lines.push(`${indent}  <bpmn:childLaneSet id="ChildLaneSet_${escapeAttribute(lane.id)}">`);
    for (const child of children) renderLane(child, process, lines, depth + 2);
    lines.push(`${indent}  </bpmn:childLaneSet>`);
  }
  lines.push(`${indent}</bpmn:lane>`);
}

function renderContainer(
  process: BpmnProcess,
  parentSubProcessId: string | undefined,
  lines: string[],
  depth: number
): void {
  for (const node of Object.values(process.nodes).filter(
    item => item.parentSubProcessId === parentSubProcessId
  )) {
    renderFlowNode(node, process, lines, depth);
  }
  for (const flow of Object.values(process.sequenceFlows).filter(
    item => item.parentSubProcessId === parentSubProcessId
  )) {
    renderSequenceFlow(flow, lines, depth);
  }
}

function renderFlowNode(
  node: BpmnFlowNode,
  process: BpmnProcess,
  lines: string[],
  depth: number
): void {
  const indent = '  '.repeat(depth);
  const attributes = [
    `id="${escapeAttribute(node.id)}"`,
    node.name ? `name="${escapeAttribute(node.name)}"` : '',
    node.defaultFlow ? `default="${escapeAttribute(node.defaultFlow)}"` : '',
    node.attachedToRef ? `attachedToRef="${escapeAttribute(node.attachedToRef)}"` : '',
    node.cancelActivity !== undefined ? `cancelActivity="${node.cancelActivity}"` : '',
    node.calledElement ? `calledElement="${escapeAttribute(node.calledElement)}"` : '',
    node.triggeredByEvent !== undefined ? `triggeredByEvent="${node.triggeredByEvent}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const hasChildren =
    Boolean(node.documentation) ||
    node.eventDefinitions.length > 0 ||
    ['subProcess', 'transaction'].includes(node.type);
  if (!hasChildren) {
    lines.push(`${indent}<bpmn:${node.type} ${attributes}/>`);
    return;
  }
  lines.push(`${indent}<bpmn:${node.type} ${attributes}>`);
  if (node.documentation) {
    lines.push(
      `${indent}  <bpmn:documentation>${escapeText(node.documentation)}</bpmn:documentation>`
    );
  }
  for (const definition of node.eventDefinitions) {
    renderEventDefinition(definition, lines, depth + 1);
  }
  if (['subProcess', 'transaction'].includes(node.type)) {
    renderContainer(process, node.id, lines, depth + 1);
  }
  lines.push(`${indent}</bpmn:${node.type}>`);
}

function renderEventDefinition(
  definition: BpmnEventDefinition,
  lines: string[],
  depth: number
): void {
  const indent = '  '.repeat(depth);
  const tag = `${definition.type}EventDefinition`;
  const referenceNames: Partial<Record<BpmnEventDefinition['type'], string>> = {
    compensate: 'activityRef',
    error: 'errorRef',
    escalation: 'escalationRef',
    link: 'name',
    message: 'messageRef',
    signal: 'signalRef',
  };
  const referenceName = referenceNames[definition.type];
  const reference =
    referenceName && definition.reference
      ? ` ${referenceName}="${escapeAttribute(definition.reference)}"`
      : '';
  if (definition.expression === undefined) {
    lines.push(`${indent}<bpmn:${tag}${reference}/>`);
    return;
  }
  lines.push(`${indent}<bpmn:${tag}${reference}>`);
  const expressionTag = definition.expressionKind ?? 'condition';
  lines.push(
    `${indent}  <bpmn:${expressionTag} xsi:type="bpmn:tFormalExpression">${escapeText(definition.expression)}</bpmn:${expressionTag}>`
  );
  lines.push(`${indent}</bpmn:${tag}>`);
}

function renderSequenceFlow(flow: BpmnSequenceFlow, lines: string[], depth: number): void {
  const indent = '  '.repeat(depth);
  const attributes = `id="${escapeAttribute(flow.id)}" sourceRef="${escapeAttribute(flow.sourceRef)}" targetRef="${escapeAttribute(flow.targetRef)}"${flow.name ? ` name="${escapeAttribute(flow.name)}"` : ''}${flow.isImmediate !== undefined ? ` isImmediate="${flow.isImmediate}"` : ''}`;
  if (!flow.documentation && flow.conditionExpression === undefined) {
    lines.push(`${indent}<bpmn:sequenceFlow ${attributes}/>`);
    return;
  }
  lines.push(`${indent}<bpmn:sequenceFlow ${attributes}>`);
  if (flow.documentation) {
    lines.push(
      `${indent}  <bpmn:documentation>${escapeText(flow.documentation)}</bpmn:documentation>`
    );
  }
  if (flow.conditionExpression !== undefined) {
    lines.push(
      `${indent}  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeText(flow.conditionExpression)}</bpmn:conditionExpression>`
    );
  }
  lines.push(`${indent}</bpmn:sequenceFlow>`);
}

function renderCollaboration(collaboration: BpmnCollaboration, lines: string[]): void {
  lines.push(
    `  <bpmn:collaboration id="${escapeAttribute(collaboration.id)}"${collaboration.name ? ` name="${escapeAttribute(collaboration.name)}"` : ''}>`
  );
  for (const participant of Object.values(collaboration.participants)) {
    lines.push(
      `    <bpmn:participant id="${escapeAttribute(participant.id)}"${participant.name ? ` name="${escapeAttribute(participant.name)}"` : ''}${participant.processRef ? ` processRef="${escapeAttribute(participant.processRef)}"` : ''}/>`
    );
  }
  for (const flow of Object.values(collaboration.messageFlows)) {
    lines.push(
      `    <bpmn:messageFlow id="${escapeAttribute(flow.id)}" sourceRef="${escapeAttribute(flow.sourceRef)}" targetRef="${escapeAttribute(flow.targetRef)}"${flow.name ? ` name="${escapeAttribute(flow.name)}"` : ''}${flow.messageRef ? ` messageRef="${escapeAttribute(flow.messageRef)}"` : ''}/>`
    );
  }
  lines.push('  </bpmn:collaboration>');
}

function renderDiagram(diagram: BpmnDiagram, lines: string[]): void {
  lines.push(
    `  <bpmndi:BPMNDiagram id="${escapeAttribute(diagram.id)}"${diagram.name ? ` name="${escapeAttribute(diagram.name)}"` : ''}>`
  );
  lines.push(
    `    <bpmndi:BPMNPlane id="${escapeAttribute(diagram.planeId)}" bpmnElement="${escapeAttribute(diagram.planeElement)}">`
  );
  for (const shape of diagram.shapes) {
    lines.push(
      `      <bpmndi:BPMNShape id="${escapeAttribute(shape.id)}" bpmnElement="${escapeAttribute(shape.bpmnElement)}"${shape.isHorizontal !== undefined ? ` isHorizontal="${shape.isHorizontal}"` : ''}>`
    );
    lines.push(
      `        <dc:Bounds x="${shape.bounds.x}" y="${shape.bounds.y}" width="${shape.bounds.width}" height="${shape.bounds.height}"/>`
    );
    lines.push('      </bpmndi:BPMNShape>');
  }
  for (const edge of diagram.edges) {
    lines.push(
      `      <bpmndi:BPMNEdge id="${escapeAttribute(edge.id)}" bpmnElement="${escapeAttribute(edge.bpmnElement)}">`
    );
    for (const point of edge.waypoints) {
      lines.push(`        <di:waypoint x="${point.x}" y="${point.y}"/>`);
    }
    lines.push('      </bpmndi:BPMNEdge>');
  }
  lines.push('    </bpmndi:BPMNPlane>');
  lines.push('  </bpmndi:BPMNDiagram>');
}

function generateDiagrams(document: BpmnDocument): BpmnDiagram[] {
  return document.processes.map((process, processIndex) => {
    const nodes = Object.values(process.nodes);
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
    nodes.forEach((node, index) => {
      const isEvent = node.type.toLowerCase().includes('event');
      const isGateway = node.type.endsWith('Gateway');
      const width = isEvent ? 36 : isGateway ? 50 : 110;
      const height = isEvent ? 36 : isGateway ? 50 : 80;
      positions.set(node.id, {
        x: 80 + (index % 6) * 170,
        y: 100 + Math.floor(index / 6) * 150,
        width,
        height,
      });
    });
    return {
      id: `BPMNDiagram_${processIndex + 1}`,
      planeId: `BPMNPlane_${processIndex + 1}`,
      planeElement: process.id,
      shapes: nodes.map(node => ({
        id: `${node.id}_di`,
        bpmnElement: node.id,
        bounds: positions.get(node.id)!,
      })),
      edges: Object.values(process.sequenceFlows)
        .filter(flow => positions.has(flow.sourceRef) && positions.has(flow.targetRef))
        .map(flow => {
          const source = positions.get(flow.sourceRef)!;
          const target = positions.get(flow.targetRef)!;
          return {
            id: `${flow.id}_di`,
            bpmnElement: flow.id,
            waypoints: [
              { x: source.x + source.width, y: source.y + source.height / 2 },
              { x: target.x, y: target.y + target.height / 2 },
            ],
          };
        }),
    };
  });
}

function detectUnsupportedElements(xml: string): string[] {
  const unsupported = new Set<string>();
  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?(dataObjectReference|dataStoreReference|dataInputAssociation|dataOutputAssociation|textAnnotation|association|group|choreography|conversation|adHocSubProcess|callChoreography|subChoreography)\b/gi;
  for (const match of xml.matchAll(pattern)) unsupported.add(match[1]);
  return [...unsupported].sort();
}

function documentation(node: XmlNode): string | undefined {
  return asArray(node.documentation)
    .map(textValue)
    .find((value): value is string => value !== undefined);
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') return decodeXmlReferences(value);
  const node = asNode(value);
  if (!node) return undefined;
  return typeof node['#text'] === 'string' ? decodeXmlReferences(node['#text']) : undefined;
}

function attribute(node: XmlNode, name: string): string | undefined {
  const value = node[`@_${name}`];
  return typeof value === 'string' ? decodeXmlReferences(value) : undefined;
}

function requiredAttribute(node: XmlNode, name: string, context: string): string {
  const value = attribute(node, name);
  if (!value) {
    throw new BpmnXmlError('ATTRIBUTE_REQUIRED', `${context} requires attribute "${name}"`);
  }
  return value;
}

function numberAttribute(node: XmlNode, name: string): number {
  const value = Number(requiredAttribute(node, name, 'diagram element'));
  if (!Number.isFinite(value)) {
    throw new BpmnXmlError('NUMBER_REQUIRED', `Diagram attribute "${name}" must be numeric`);
  }
  return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function parseProcessType(value: string | undefined): BpmnProcess['processType'] | undefined {
  return value === 'None' || value === 'Public' || value === 'Private' ? value : undefined;
}

function asArray(value: unknown): XmlNode[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map(item => asNode(item)).filter((item): item is XmlNode => item !== null);
  }
  const node = asNode(value);
  return node ? [node] : [];
}

function asNode(value: unknown): XmlNode | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as XmlNode)
    : typeof value === 'string'
      ? { '#text': value }
      : null;
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeXmlReferences(value: string): string {
  return value.replace(/&(#(?:x[0-9A-Fa-f]+|[0-9]+)|amp|lt|gt|quot|apos);/g, (_, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const numeric = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(numeric) && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : '';
  });
}

function unique(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}
