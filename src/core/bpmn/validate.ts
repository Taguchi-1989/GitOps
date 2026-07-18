import { BpmnDiagnostic, BpmnDocument, BpmnDocumentSchema, BpmnValidationResult } from './types';

const INVALID_XML_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function validateBpmnDocument(input: unknown): BpmnValidationResult {
  const parsed = BpmnDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(issue => ({
        severity: 'error',
        code: 'SCHEMA_INVALID',
        message: issue.message,
        path: issue.path.join('.'),
      })),
      warnings: [],
      processCount: 0,
      nodeCount: 0,
      flowCount: 0,
    };
  }

  const document = parsed.data;
  const errors: BpmnDiagnostic[] = [];
  const warnings: BpmnDiagnostic[] = [];
  const ids = new Map<string, string>();
  const globalElements = new Set<string>();
  let nodeCount = 0;
  let flowCount = 0;

  const register = (id: string, path: string): void => {
    const existing = ids.get(id);
    if (existing) {
      errors.push(error('DUPLICATE_ID', `BPMN id "${id}" is also used at ${existing}`, path));
    } else {
      ids.set(id, path);
    }
    globalElements.add(id);
  };

  register(document.definitions.id, 'definitions.id');
  validateText(document.definitions.targetNamespace, 'definitions.targetNamespace', errors);

  for (const [globalIndex, global] of document.globalElements.entries()) {
    register(global.id, `globalElements.${globalIndex}.id`);
    validateText(global.name, `globalElements.${globalIndex}.name`, errors);
    for (const [name, value] of Object.entries(global.attributes)) {
      validateText(value, `globalElements.${globalIndex}.attributes.${name}`, errors);
    }
  }

  for (const [processIndex, process] of document.processes.entries()) {
    const processPath = `processes.${processIndex}`;
    register(process.id, `${processPath}.id`);
    validateText(process.name, `${processPath}.name`, errors);
    const nodeIds = new Set(Object.keys(process.nodes));
    const flowIds = new Set(Object.keys(process.sequenceFlows));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    nodeCount += nodeIds.size;
    flowCount += flowIds.size;

    for (const [nodeId, node] of Object.entries(process.nodes)) {
      const path = `${processPath}.nodes.${nodeId}`;
      register(node.id, `${path}.id`);
      validateText(node.name, `${path}.name`, errors);
      validateText(node.documentation, `${path}.documentation`, errors);
      if (node.parentSubProcessId) {
        const parent = process.nodes[node.parentSubProcessId];
        if (!parent || !['subProcess', 'transaction'].includes(parent.type)) {
          errors.push(
            error(
              'PARENT_SUBPROCESS_NOT_FOUND',
              `Parent subprocess "${node.parentSubProcessId}" does not exist`,
              `${path}.parentSubProcessId`
            )
          );
        }
      }
      if (node.attachedToRef) {
        if (node.type !== 'boundaryEvent') {
          errors.push(
            error('ATTACHMENT_NOT_BOUNDARY_EVENT', 'Only boundaryEvent can use attachedToRef', path)
          );
        } else if (!nodeIds.has(node.attachedToRef)) {
          errors.push(
            error(
              'ATTACHED_NODE_NOT_FOUND',
              `Attached node "${node.attachedToRef}" does not exist`,
              `${path}.attachedToRef`
            )
          );
        }
      }
      for (const definition of node.eventDefinitions) {
        validateText(definition.expression, `${path}.eventDefinitions.expression`, errors);
      }
    }

    detectSubProcessCycles(process, errors, processPath);

    for (const [flowId, flow] of Object.entries(process.sequenceFlows)) {
      const path = `${processPath}.sequenceFlows.${flowId}`;
      register(flow.id, `${path}.id`);
      validateText(flow.name, `${path}.name`, errors);
      validateText(flow.documentation, `${path}.documentation`, errors);
      validateText(flow.conditionExpression, `${path}.conditionExpression`, errors);
      if (!nodeIds.has(flow.sourceRef)) {
        errors.push(
          error(
            'SEQUENCE_SOURCE_NOT_FOUND',
            `Sequence flow source "${flow.sourceRef}" does not exist in process "${process.id}"`,
            `${path}.sourceRef`
          )
        );
      }
      if (!nodeIds.has(flow.targetRef)) {
        errors.push(
          error(
            'SEQUENCE_TARGET_NOT_FOUND',
            `Sequence flow target "${flow.targetRef}" does not exist in process "${process.id}"`,
            `${path}.targetRef`
          )
        );
      }
      outgoing.set(flow.sourceRef, (outgoing.get(flow.sourceRef) ?? 0) + 1);
      incoming.set(flow.targetRef, (incoming.get(flow.targetRef) ?? 0) + 1);
      if (flow.parentSubProcessId && !nodeIds.has(flow.parentSubProcessId)) {
        errors.push(
          error(
            'FLOW_PARENT_NOT_FOUND',
            `Sequence flow parent "${flow.parentSubProcessId}" does not exist`,
            `${path}.parentSubProcessId`
          )
        );
      }
    }

    for (const [nodeId, node] of Object.entries(process.nodes)) {
      const path = `${processPath}.nodes.${nodeId}`;
      if (node.defaultFlow) {
        const flow = process.sequenceFlows[node.defaultFlow];
        if (!flow || flow.sourceRef !== nodeId) {
          errors.push(
            error(
              'DEFAULT_FLOW_INVALID',
              `Default flow "${node.defaultFlow}" must be an outgoing sequence flow`,
              `${path}.defaultFlow`
            )
          );
        }
      }
      if (node.type === 'startEvent' && (incoming.get(nodeId) ?? 0) > 0) {
        warnings.push(
          warning('START_EVENT_HAS_INCOMING', `Start event "${nodeId}" has an incoming flow`, path)
        );
      }
      if (node.type === 'endEvent' && (outgoing.get(nodeId) ?? 0) > 0) {
        warnings.push(
          warning('END_EVENT_HAS_OUTGOING', `End event "${nodeId}" has an outgoing flow`, path)
        );
      }
    }

    const laneOwners = new Map<string, string>();
    for (const [laneId, lane] of Object.entries(process.lanes)) {
      const path = `${processPath}.lanes.${laneId}`;
      register(lane.id, `${path}.id`);
      if (lane.parentLaneId && !process.lanes[lane.parentLaneId]) {
        errors.push(
          error(
            'PARENT_LANE_NOT_FOUND',
            `Parent lane "${lane.parentLaneId}" does not exist`,
            `${path}.parentLaneId`
          )
        );
      }
      for (const nodeRef of lane.flowNodeRefs) {
        if (!nodeIds.has(nodeRef)) {
          errors.push(error('LANE_NODE_NOT_FOUND', `Lane node "${nodeRef}" does not exist`, path));
          continue;
        }
        const owner = laneOwners.get(nodeRef);
        if (owner && owner !== laneId) {
          errors.push(
            error(
              'MULTIPLE_LANE_OWNERS',
              `Node "${nodeRef}" belongs to both "${owner}" and "${laneId}"`,
              path
            )
          );
        } else {
          laneOwners.set(nodeRef, laneId);
        }
      }
    }

    if (process.isExecutable) {
      const topLevelNodes = Object.values(process.nodes).filter(node => !node.parentSubProcessId);
      if (!topLevelNodes.some(node => node.type === 'startEvent')) {
        warnings.push(
          warning(
            'EXECUTABLE_PROCESS_WITHOUT_START',
            `Executable process "${process.id}" has no top-level start event`,
            processPath
          )
        );
      }
      if (!topLevelNodes.some(node => node.type === 'endEvent')) {
        warnings.push(
          warning(
            'EXECUTABLE_PROCESS_WITHOUT_END',
            `Executable process "${process.id}" has no top-level end event`,
            processPath
          )
        );
      }
    }
  }

  for (const [collaborationIndex, collaboration] of document.collaborations.entries()) {
    const collaborationPath = `collaborations.${collaborationIndex}`;
    register(collaboration.id, `${collaborationPath}.id`);
    for (const [participantId, participant] of Object.entries(collaboration.participants)) {
      const path = `${collaborationPath}.participants.${participantId}`;
      register(participant.id, `${path}.id`);
      if (
        participant.processRef &&
        !document.processes.some(process => process.id === participant.processRef)
      ) {
        errors.push(
          error(
            'PARTICIPANT_PROCESS_NOT_FOUND',
            `Participant process "${participant.processRef}" does not exist`,
            `${path}.processRef`
          )
        );
      }
    }
    const participantIds = new Set(Object.keys(collaboration.participants));
    const messageEndpoints = new Set([...globalElements, ...participantIds]);
    for (const [messageFlowId, messageFlow] of Object.entries(collaboration.messageFlows)) {
      const path = `${collaborationPath}.messageFlows.${messageFlowId}`;
      register(messageFlow.id, `${path}.id`);
      if (!messageEndpoints.has(messageFlow.sourceRef)) {
        errors.push(
          error(
            'MESSAGE_SOURCE_NOT_FOUND',
            `Message-flow source "${messageFlow.sourceRef}" does not exist`,
            `${path}.sourceRef`
          )
        );
      }
      if (!messageEndpoints.has(messageFlow.targetRef)) {
        errors.push(
          error(
            'MESSAGE_TARGET_NOT_FOUND',
            `Message-flow target "${messageFlow.targetRef}" does not exist`,
            `${path}.targetRef`
          )
        );
      }
    }
  }

  const diagramElements = new Set(globalElements);
  for (const diagram of document.diagrams) {
    register(diagram.id, `diagrams.${diagram.id}.id`);
    register(diagram.planeId, `diagrams.${diagram.id}.planeId`);
    if (!diagramElements.has(diagram.planeElement)) {
      errors.push(
        error(
          'PLANE_ELEMENT_NOT_FOUND',
          `Diagram plane element "${diagram.planeElement}" does not exist`,
          `diagrams.${diagram.id}.planeElement`
        )
      );
    }
    for (const shape of diagram.shapes) {
      register(shape.id, `diagrams.${diagram.id}.shapes.${shape.id}`);
      if (!diagramElements.has(shape.bpmnElement)) {
        errors.push(
          error(
            'SHAPE_ELEMENT_NOT_FOUND',
            `Shape element "${shape.bpmnElement}" does not exist`,
            `diagrams.${diagram.id}.shapes.${shape.id}`
          )
        );
      }
    }
    for (const edge of diagram.edges) {
      register(edge.id, `diagrams.${diagram.id}.edges.${edge.id}`);
      if (!diagramElements.has(edge.bpmnElement)) {
        errors.push(
          error(
            'EDGE_ELEMENT_NOT_FOUND',
            `Edge element "${edge.bpmnElement}" does not exist`,
            `diagrams.${diagram.id}.edges.${edge.id}`
          )
        );
      }
    }
  }

  if (document.profile === 'flowops-conceptual') {
    warnings.push(
      warning(
        'CONCEPTUAL_PROFILE',
        'Mermaid conversion preserves core control flow but not full BPMN execution or vendor-extension semantics.'
      )
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    processCount: document.processes.length,
    nodeCount,
    flowCount,
  };
}

function detectSubProcessCycles(
  process: BpmnDocument['processes'][number],
  errors: BpmnDiagnostic[],
  processPath: string
): void {
  for (const node of Object.values(process.nodes)) {
    const visited = new Set<string>([node.id]);
    let parent = node.parentSubProcessId;
    while (parent) {
      if (visited.has(parent)) {
        errors.push(
          error(
            'SUBPROCESS_CYCLE',
            `Subprocess parent cycle detected at "${parent}"`,
            `${processPath}.nodes.${node.id}.parentSubProcessId`
          )
        );
        break;
      }
      visited.add(parent);
      parent = process.nodes[parent]?.parentSubProcessId;
    }
  }
}

function validateText(value: string | undefined, path: string, errors: BpmnDiagnostic[]): void {
  if (value && INVALID_XML_CHARACTER.test(value)) {
    errors.push(
      error('INVALID_XML_CHARACTER', 'Value contains an XML 1.0 control character', path)
    );
  }
}

function error(code: string, message: string, path?: string): BpmnDiagnostic {
  return { severity: 'error', code, message, path };
}

function warning(code: string, message: string, path?: string): BpmnDiagnostic {
  return { severity: 'warning', code, message, path };
}
