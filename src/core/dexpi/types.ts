import { z } from 'zod';

export const DEXPI_DOCUMENT_SCHEMA_VERSION = 'flowops-dexpi.v1' as const;
export const DEXPI_STANDARD_VERSION = '2.0.0' as const;
export const DEXPI_MAX_INPUT_LENGTH = 5_000_000;

export type DexpiDataValue =
  | string
  | number
  | boolean
  | { kind: 'integer'; value: number }
  | { kind: 'double'; value: number }
  | { kind: 'datetime'; value: string }
  | { kind: 'data-reference'; value: string }
  | { kind: 'undefined' }
  | { kind: 'aggregated'; type: string; data: Record<string, DexpiDataValue[]> };

export const DexpiDataValueSchema: z.ZodType<DexpiDataValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.object({ kind: z.literal('integer'), value: z.number().int() }).strict(),
    z.object({ kind: z.literal('double'), value: z.number().finite() }).strict(),
    z.object({ kind: z.literal('datetime'), value: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('data-reference'), value: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('undefined') }).strict(),
    z
      .object({
        kind: z.literal('aggregated'),
        type: z.string().min(1),
        data: z.record(z.string().min(1), z.array(DexpiDataValueSchema)),
      })
      .strict(),
  ])
);

export const DexpiComponentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('object'), objectId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('reference'), objectRef: z.string().min(1) }).strict(),
]);
export type DexpiComponent = z.infer<typeof DexpiComponentSchema>;

export const DexpiObjectSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'DeXPI ID must use XML name characters'),
    name: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'DeXPI name must use XML name characters')
      .optional(),
    type: z.string().min(1),
    data: z.record(z.string().min(1), z.array(DexpiDataValueSchema)).default({}),
    components: z.record(z.string().min(1), z.array(DexpiComponentSchema)).default({}),
    references: z.record(z.string().min(1), z.array(z.string().min(1))).default({}),
    generatedId: z.boolean().optional(),
  })
  .strict();
export type DexpiObject = z.infer<typeof DexpiObjectSchema>;

export const DexpiImportSchema = z
  .object({
    prefix: z.string().min(1),
    source: z.string().min(1),
  })
  .strict();

export const DexpiDocumentSchema = z
  .object({
    schemaVersion: z.literal(DEXPI_DOCUMENT_SCHEMA_VERSION),
    standard: z
      .object({
        name: z.literal('DEXPI'),
        version: z.literal(DEXPI_STANDARD_VERSION),
        serialization: z.literal('DEXPI_XML'),
      })
      .strict(),
    profile: z.enum(['dexpi-2.0-structural', 'flowops-conceptual']),
    model: z
      .object({
        name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        uri: z.string().min(1),
        imports: z.array(DexpiImportSchema),
      })
      .strict(),
    rootObjectIds: z.array(z.string().min(1)).min(1),
    objects: z.record(z.string().min(1), DexpiObjectSchema),
    metadata: z.record(z.string(), z.string()).default({}),
  })
  .strict()
  .superRefine((document, context) => {
    for (const [key, object] of Object.entries(document.objects)) {
      if (key !== object.id) {
        context.addIssue({
          code: 'custom',
          path: ['objects', key, 'id'],
          message: `Object map key "${key}" must equal object.id "${object.id}"`,
        });
      }
    }
  });

export type DexpiDocument = z.infer<typeof DexpiDocumentSchema>;

export interface DexpiDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface DexpiValidationResult {
  valid: boolean;
  errors: DexpiDiagnostic[];
  warnings: DexpiDiagnostic[];
  objectCount: number;
  referenceCount: number;
}

export const DEFAULT_DEXPI_IMPORTS = [
  { prefix: 'Builtin', source: 'https://data.dexpi.org/models/2.0.0/Builtin.xml' },
  { prefix: 'Core', source: 'https://data.dexpi.org/models/2.0.0/Core.xml' },
  { prefix: 'Plant', source: 'https://data.dexpi.org/models/2.0.0/Plant.xml' },
] as const;
