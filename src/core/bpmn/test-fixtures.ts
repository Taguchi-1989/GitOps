import { BPMN_DOCUMENT_SCHEMA_VERSION, BPMN_STANDARD_VERSION, BpmnDocument } from './types';

export function createBpmnDocument(): BpmnDocument {
  return {
    schemaVersion: BPMN_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'BPMN', version: BPMN_STANDARD_VERSION, serialization: 'BPMN_XML' },
    profile: 'bpmn-2.0-core',
    definitions: {
      id: 'Definitions_Order',
      targetNamespace: 'urn:flowops:bpmn:order',
      exporter: 'FlowOps Test',
      exporterVersion: '1.0',
    },
    processes: [
      {
        id: 'Process_Order',
        name: 'Order approval',
        isExecutable: true,
        nodes: {
          Start_Order: {
            id: 'Start_Order',
            type: 'startEvent',
            name: 'Order received',
            eventDefinitions: [],
          },
          Review_Order: {
            id: 'Review_Order',
            type: 'userTask',
            name: 'Review order',
            laneId: 'Lane_Reviewer',
            eventDefinitions: [],
          },
          Gateway_Approved: {
            id: 'Gateway_Approved',
            type: 'exclusiveGateway',
            name: 'Approved?',
            defaultFlow: 'Flow_Rework',
            eventDefinitions: [],
          },
          Fulfill_Order: {
            id: 'Fulfill_Order',
            type: 'serviceTask',
            name: 'Fulfill order',
            laneId: 'Lane_Reviewer',
            eventDefinitions: [],
          },
          End_Order: {
            id: 'End_Order',
            type: 'endEvent',
            name: 'Completed',
            eventDefinitions: [],
          },
        },
        sequenceFlows: {
          Flow_Start: {
            id: 'Flow_Start',
            sourceRef: 'Start_Order',
            targetRef: 'Review_Order',
          },
          Flow_Review: {
            id: 'Flow_Review',
            sourceRef: 'Review_Order',
            targetRef: 'Gateway_Approved',
          },
          Flow_Approved: {
            id: 'Flow_Approved',
            sourceRef: 'Gateway_Approved',
            targetRef: 'Fulfill_Order',
            name: 'yes',
            conditionExpression: '${approved}',
          },
          Flow_Rework: {
            id: 'Flow_Rework',
            sourceRef: 'Gateway_Approved',
            targetRef: 'Review_Order',
            name: 'no',
          },
          Flow_End: {
            id: 'Flow_End',
            sourceRef: 'Fulfill_Order',
            targetRef: 'End_Order',
          },
        },
        lanes: {
          Lane_Reviewer: {
            id: 'Lane_Reviewer',
            name: 'Reviewer',
            flowNodeRefs: ['Review_Order', 'Fulfill_Order'],
          },
        },
      },
    ],
    globalElements: [],
    collaborations: [],
    diagrams: [],
    metadata: { owner: 'process-governance' },
  };
}

export function createRichBpmnDocument(): BpmnDocument {
  const document = createBpmnDocument();
  const process = document.processes[0];
  process.processType = 'Private';
  process.documentation = 'Executable approval process';
  process.nodes.Start_Order.documentation = 'Triggered by an incoming order message';
  process.nodes.Start_Order.eventDefinitions = [{ type: 'message', reference: 'Message_Order' }];
  process.nodes.Review_Order.documentation = 'A human validates the order';
  process.nodes.Call_Fraud_Check = {
    id: 'Call_Fraud_Check',
    type: 'callActivity',
    name: 'Fraud check',
    calledElement: 'FraudProcess',
    eventDefinitions: [],
  };
  process.nodes.SubProcess_Pack = {
    id: 'SubProcess_Pack',
    type: 'subProcess',
    name: 'Pack order',
    triggeredByEvent: false,
    eventDefinitions: [],
  };
  process.nodes.Task_Pack = {
    id: 'Task_Pack',
    type: 'manualTask',
    name: 'Pack items',
    parentSubProcessId: 'SubProcess_Pack',
    eventDefinitions: [],
  };
  process.nodes.Boundary_Timeout = {
    id: 'Boundary_Timeout',
    type: 'boundaryEvent',
    name: 'Review timeout',
    attachedToRef: 'Review_Order',
    cancelActivity: false,
    eventDefinitions: [
      {
        type: 'timer',
        expressionKind: 'timeDuration',
        expression: 'PT24H',
      },
    ],
  };
  process.sequenceFlows.Flow_Fraud = {
    id: 'Flow_Fraud',
    sourceRef: 'Fulfill_Order',
    targetRef: 'Call_Fraud_Check',
    documentation: 'Invoke shared fraud process',
    isImmediate: false,
  };
  process.sequenceFlows.Flow_End.sourceRef = 'Call_Fraud_Check';
  process.sequenceFlows.Flow_Pack_Inner = {
    id: 'Flow_Pack_Inner',
    sourceRef: 'Task_Pack',
    targetRef: 'Task_Pack',
    parentSubProcessId: 'SubProcess_Pack',
  };
  process.lanes.Lane_All = {
    id: 'Lane_All',
    name: 'Operations',
    flowNodeRefs: [],
  };
  process.lanes.Lane_Reviewer.parentLaneId = 'Lane_All';
  document.globalElements = [
    {
      id: 'Message_Order',
      type: 'message',
      name: 'Order message',
      attributes: { itemRef: 'Item_Order' },
    },
    { id: 'Signal_Ready', type: 'signal', attributes: {} },
    { id: 'Error_Failed', type: 'error', name: 'Failed', attributes: { errorCode: 'E-1' } },
    {
      id: 'Escalation_Manual',
      type: 'escalation',
      attributes: { escalationCode: 'MANUAL' },
    },
  ];
  document.collaborations = [
    {
      id: 'Collaboration_Order',
      name: 'Order collaboration',
      participants: {
        Participant_Buyer: {
          id: 'Participant_Buyer',
          name: 'Buyer',
        },
        Participant_Seller: {
          id: 'Participant_Seller',
          name: 'Seller',
          processRef: 'Process_Order',
        },
      },
      messageFlows: {
        MessageFlow_Order: {
          id: 'MessageFlow_Order',
          name: 'Submit order',
          sourceRef: 'Participant_Buyer',
          targetRef: 'Participant_Seller',
          messageRef: 'Message_Order',
        },
      },
    },
  ];
  document.diagrams = [
    {
      id: 'Diagram_Order',
      name: 'Order diagram',
      planeId: 'Plane_Order',
      planeElement: 'Process_Order',
      shapes: [
        {
          id: 'Start_Order_di',
          bpmnElement: 'Start_Order',
          bounds: { x: 80, y: 100, width: 36, height: 36 },
          isHorizontal: false,
        },
      ],
      edges: [
        {
          id: 'Flow_Start_di',
          bpmnElement: 'Flow_Start',
          waypoints: [
            { x: 116, y: 118 },
            { x: 220, y: 118 },
          ],
        },
      ],
    },
  ];
  return document;
}
