import { describe, expect, it } from 'vitest';
import { createBpmnDocument } from './test-fixtures';
import { validateBpmnDocument } from './validate';

describe('validateBpmnDocument', () => {
  it('accepts a valid core process', () => {
    const validation = validateBpmnDocument(createBpmnDocument());
    expect(validation.valid).toBe(true);
    expect(validation.processCount).toBe(1);
    expect(validation.nodeCount).toBe(5);
    expect(validation.flowCount).toBe(5);
  });

  it('rejects a sequence flow with a missing target', () => {
    const document = createBpmnDocument();
    document.processes[0].sequenceFlows.Flow_End.targetRef = 'Missing_End';
    const validation = validateBpmnDocument(document);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(item => item.code === 'SEQUENCE_TARGET_NOT_FOUND')).toBe(true);
  });

  it('rejects duplicate ids across BPMN elements', () => {
    const document = createBpmnDocument();
    document.processes[0].id = 'Definitions_Order';
    const validation = validateBpmnDocument(document);
    expect(validation.errors.some(item => item.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('warns when a start event has incoming control flow', () => {
    const document = createBpmnDocument();
    document.processes[0].sequenceFlows.Flow_End.targetRef = 'Start_Order';
    const validation = validateBpmnDocument(document);
    expect(validation.warnings.some(item => item.code === 'START_EVENT_HAS_INCOMING')).toBe(true);
  });

  it('reports structural errors across subprocesses, boundaries, lanes, and defaults', () => {
    const document = createBpmnDocument();
    const process = document.processes[0];
    process.nodes.Review_Order.parentSubProcessId = 'Start_Order';
    process.nodes.Start_Order.attachedToRef = 'Missing';
    process.nodes.Gateway_Approved.defaultFlow = 'Flow_Start';
    process.sequenceFlows.Flow_Start.parentSubProcessId = 'Missing_SubProcess';
    process.lanes.Lane_Reviewer.parentLaneId = 'Missing_Lane';
    process.lanes.Lane_Reviewer.flowNodeRefs.push('Missing_Node');
    process.lanes.Lane_Second = {
      id: 'Lane_Second',
      flowNodeRefs: ['Review_Order'],
    };
    const validation = validateBpmnDocument(document);
    expect(validation.errors.map(item => item.code)).toEqual(
      expect.arrayContaining([
        'PARENT_SUBPROCESS_NOT_FOUND',
        'ATTACHMENT_NOT_BOUNDARY_EVENT',
        'DEFAULT_FLOW_INVALID',
        'FLOW_PARENT_NOT_FOUND',
        'PARENT_LANE_NOT_FOUND',
        'LANE_NODE_NOT_FOUND',
        'MULTIPLE_LANE_OWNERS',
      ])
    );
  });

  it('detects subprocess cycles and missing boundary attachments', () => {
    const document = createBpmnDocument();
    const process = document.processes[0];
    process.nodes.Sub_A = {
      id: 'Sub_A',
      type: 'subProcess',
      parentSubProcessId: 'Sub_B',
      eventDefinitions: [],
    };
    process.nodes.Sub_B = {
      id: 'Sub_B',
      type: 'subProcess',
      parentSubProcessId: 'Sub_A',
      eventDefinitions: [],
    };
    process.nodes.Boundary = {
      id: 'Boundary',
      type: 'boundaryEvent',
      attachedToRef: 'Missing_Task',
      eventDefinitions: [],
    };
    const validation = validateBpmnDocument(document);
    expect(validation.errors.some(item => item.code === 'SUBPROCESS_CYCLE')).toBe(true);
    expect(validation.errors.some(item => item.code === 'ATTACHED_NODE_NOT_FOUND')).toBe(true);
  });

  it('reports collaboration and diagram reference errors', () => {
    const document = createBpmnDocument();
    document.collaborations = [
      {
        id: 'Collaboration_1',
        participants: {
          Participant_1: { id: 'Participant_1', processRef: 'Missing_Process' },
        },
        messageFlows: {
          MessageFlow_1: {
            id: 'MessageFlow_1',
            sourceRef: 'Missing_Source',
            targetRef: 'Missing_Target',
          },
        },
      },
    ];
    document.diagrams = [
      {
        id: 'Diagram_1',
        planeId: 'Plane_1',
        planeElement: 'Missing_Plane_Element',
        shapes: [
          {
            id: 'Shape_1',
            bpmnElement: 'Missing_Shape_Element',
            bounds: { x: 0, y: 0, width: 10, height: 10 },
          },
        ],
        edges: [
          {
            id: 'Edge_1',
            bpmnElement: 'Missing_Edge_Element',
            waypoints: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
      },
    ];
    const validation = validateBpmnDocument(document);
    expect(validation.errors.map(item => item.code)).toEqual(
      expect.arrayContaining([
        'PARTICIPANT_PROCESS_NOT_FOUND',
        'MESSAGE_SOURCE_NOT_FOUND',
        'MESSAGE_TARGET_NOT_FOUND',
        'PLANE_ELEMENT_NOT_FOUND',
        'SHAPE_ELEMENT_NOT_FOUND',
        'EDGE_ELEMENT_NOT_FOUND',
      ])
    );
  });

  it('warns for executable processes without start/end and end events with outgoing flow', () => {
    const document = createBpmnDocument();
    const process = document.processes[0];
    delete process.nodes.Start_Order;
    delete process.nodes.End_Order;
    delete process.sequenceFlows.Flow_Start;
    process.sequenceFlows.Flow_End.targetRef = 'Review_Order';
    process.nodes.Review_Order.type = 'endEvent';
    const validation = validateBpmnDocument(document);
    expect(validation.warnings.map(item => item.code)).toEqual(
      expect.arrayContaining(['EXECUTABLE_PROCESS_WITHOUT_START', 'END_EVENT_HAS_OUTGOING'])
    );
  });

  it('rejects schema-invalid input and invalid XML control characters', () => {
    expect(validateBpmnDocument({}).errors[0].code).toBe('SCHEMA_INVALID');
    const document = createBpmnDocument();
    document.processes[0].nodes.Review_Order.documentation = 'bad\u0001text';
    expect(
      validateBpmnDocument(document).errors.some(item => item.code === 'INVALID_XML_CHARACTER')
    ).toBe(true);
  });
});
