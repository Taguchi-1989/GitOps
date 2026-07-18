import { z } from 'zod';

export const BPMN_DOCUMENT_SCHEMA_VERSION = 'flowops-bpmn.v1' as const;
export const BPMN_STANDARD_VERSION = '2.0.2' as const;
export const BPMN_MAX_INPUT_LENGTH = 5_000_000;

export const BpmnFlowNodeTypeSchema = z.enum([
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
]);
export type BpmnFlowNodeType = z.infer<typeof BpmnFlowNodeTypeSchema>;

export const BpmnEventDefinitionSchema = z
  .object({
    type: z.enum([
      'cancel',
      'compensate',
      'conditional',
      'error',
      'escalation',
      'link',
      'message',
      'signal',
      'terminate',
      'timer',
    ]),
    reference: z.string().min(1).optional(),
    expression: z.string().optional(),
    expressionKind: z.enum(['condition', 'timeDate', 'timeDuration', 'timeCycle']).optional(),
  })
  .strict();
export type BpmnEventDefinition = z.infer<typeof BpmnEventDefinitionSchema>;

const XmlIdSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_.-]*$/, 'BPMN id must be a valid XML ID');

export const BpmnFlowNodeSchema = z
  .object({
    id: XmlIdSchema,
    type: BpmnFlowNodeTypeSchema,
    name: z.string().optional(),
    documentation: z.string().optional(),
    parentSubProcessId: XmlIdSchema.optional(),
    laneId: XmlIdSchema.optional(),
    defaultFlow: XmlIdSchema.optional(),
    attachedToRef: XmlIdSchema.optional(),
    cancelActivity: z.boolean().optional(),
    calledElement: z.string().min(1).optional(),
    triggeredByEvent: z.boolean().optional(),
    eventDefinitions: z.array(BpmnEventDefinitionSchema).default([]),
  })
  .strict();
export type BpmnFlowNode = z.infer<typeof BpmnFlowNodeSchema>;

export const BpmnSequenceFlowSchema = z
  .object({
    id: XmlIdSchema,
    sourceRef: XmlIdSchema,
    targetRef: XmlIdSchema,
    name: z.string().optional(),
    documentation: z.string().optional(),
    conditionExpression: z.string().optional(),
    isImmediate: z.boolean().optional(),
    parentSubProcessId: XmlIdSchema.optional(),
  })
  .strict();
export type BpmnSequenceFlow = z.infer<typeof BpmnSequenceFlowSchema>;

export const BpmnLaneSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    parentLaneId: XmlIdSchema.optional(),
    flowNodeRefs: z.array(XmlIdSchema).default([]),
  })
  .strict();
export type BpmnLane = z.infer<typeof BpmnLaneSchema>;

export const BpmnProcessSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    isExecutable: z.boolean().default(false),
    processType: z.enum(['None', 'Public', 'Private']).optional(),
    documentation: z.string().optional(),
    nodes: z.record(z.string().min(1), BpmnFlowNodeSchema),
    sequenceFlows: z.record(z.string().min(1), BpmnSequenceFlowSchema),
    lanes: z.record(z.string().min(1), BpmnLaneSchema).default({}),
  })
  .strict()
  .superRefine((process, context) => {
    for (const [key, node] of Object.entries(process.nodes)) {
      if (key !== node.id) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', key, 'id'],
          message: `Node map key "${key}" must equal node.id "${node.id}"`,
        });
      }
    }
    for (const [key, flow] of Object.entries(process.sequenceFlows)) {
      if (key !== flow.id) {
        context.addIssue({
          code: 'custom',
          path: ['sequenceFlows', key, 'id'],
          message: `Sequence-flow map key "${key}" must equal flow.id "${flow.id}"`,
        });
      }
    }
  });
export type BpmnProcess = z.infer<typeof BpmnProcessSchema>;

export const BpmnParticipantSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    processRef: XmlIdSchema.optional(),
  })
  .strict();
export type BpmnParticipant = z.infer<typeof BpmnParticipantSchema>;

export const BpmnMessageFlowSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    sourceRef: XmlIdSchema,
    targetRef: XmlIdSchema,
    messageRef: XmlIdSchema.optional(),
  })
  .strict();
export type BpmnMessageFlow = z.infer<typeof BpmnMessageFlowSchema>;

export const BpmnCollaborationSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    participants: z.record(z.string().min(1), BpmnParticipantSchema).default({}),
    messageFlows: z.record(z.string().min(1), BpmnMessageFlowSchema).default({}),
  })
  .strict();
export type BpmnCollaboration = z.infer<typeof BpmnCollaborationSchema>;

export const BpmnGlobalElementSchema = z
  .object({
    id: XmlIdSchema,
    type: z.enum(['message', 'signal', 'error', 'escalation']),
    name: z.string().optional(),
    attributes: z.record(z.string().min(1), z.string()).default({}),
  })
  .strict();
export type BpmnGlobalElement = z.infer<typeof BpmnGlobalElementSchema>;

export const BpmnBoundsSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  })
  .strict();

export const BpmnShapeSchema = z
  .object({
    id: XmlIdSchema,
    bpmnElement: XmlIdSchema,
    bounds: BpmnBoundsSchema,
    isHorizontal: z.boolean().optional(),
  })
  .strict();

export const BpmnEdgeSchema = z
  .object({
    id: XmlIdSchema,
    bpmnElement: XmlIdSchema,
    waypoints: z
      .array(z.object({ x: z.number().finite(), y: z.number().finite() }).strict())
      .min(2),
  })
  .strict();

export const BpmnDiagramSchema = z
  .object({
    id: XmlIdSchema,
    name: z.string().optional(),
    planeId: XmlIdSchema,
    planeElement: XmlIdSchema,
    shapes: z.array(BpmnShapeSchema).default([]),
    edges: z.array(BpmnEdgeSchema).default([]),
  })
  .strict();
export type BpmnDiagram = z.infer<typeof BpmnDiagramSchema>;

export const BpmnDocumentSchema = z
  .object({
    schemaVersion: z.literal(BPMN_DOCUMENT_SCHEMA_VERSION),
    standard: z
      .object({
        name: z.literal('BPMN'),
        version: z.literal(BPMN_STANDARD_VERSION),
        serialization: z.literal('BPMN_XML'),
      })
      .strict(),
    profile: z.enum(['bpmn-2.0-core', 'flowops-conceptual']),
    definitions: z
      .object({
        id: XmlIdSchema,
        targetNamespace: z.string().min(1),
        exporter: z.string().optional(),
        exporterVersion: z.string().optional(),
      })
      .strict(),
    processes: z.array(BpmnProcessSchema).min(1),
    globalElements: z.array(BpmnGlobalElementSchema).default([]),
    collaborations: z.array(BpmnCollaborationSchema).default([]),
    diagrams: z.array(BpmnDiagramSchema).default([]),
    metadata: z.record(z.string(), z.string()).default({}),
  })
  .strict();
export type BpmnDocument = z.infer<typeof BpmnDocumentSchema>;

export interface BpmnDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface BpmnValidationResult {
  valid: boolean;
  errors: BpmnDiagnostic[];
  warnings: BpmnDiagnostic[];
  processCount: number;
  nodeCount: number;
  flowCount: number;
}
