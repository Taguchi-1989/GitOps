import {
  DexpiDataValue,
  DexpiDocument,
  DexpiDocumentSchema,
  DexpiDiagnostic,
  DexpiValidationResult,
} from './types';

const INVALID_XML_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function validateDexpiDocument(input: unknown): DexpiValidationResult {
  const parsed = DexpiDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue): DexpiDiagnostic => ({
        severity: 'error',
        code: 'SCHEMA_INVALID',
        message: issue.message,
        path: issue.path.join('.'),
      })
    );
    return { valid: false, errors, warnings: [], objectCount: 0, referenceCount: 0 };
  }

  const document = parsed.data;
  const errors: DexpiDiagnostic[] = [];
  const warnings: DexpiDiagnostic[] = [];
  const owners = new Map<string, string>();
  const importPrefixes = new Set(document.model.imports.map(item => item.prefix));
  let referenceCount = 0;

  for (const rootId of document.rootObjectIds) {
    if (!document.objects[rootId]) {
      errors.push(
        error('ROOT_NOT_FOUND', `Root object "${rootId}" does not exist`, 'rootObjectIds')
      );
    }
  }

  for (const [objectId, object] of Object.entries(document.objects)) {
    const typePrefix = object.type.includes('/') ? object.type.split('/')[0] : '';
    if (typePrefix && !importPrefixes.has(typePrefix) && !object.type.startsWith('/')) {
      warnings.push(
        warning(
          'UNKNOWN_TYPE_PREFIX',
          `Type prefix "${typePrefix}" is not declared in model imports`,
          `objects.${objectId}.type`
        )
      );
    }

    for (const [property, values] of Object.entries(object.data)) {
      for (const value of values) {
        validateDataValue(value, `objects.${objectId}.data.${property}`, errors);
      }
    }

    for (const [property, components] of Object.entries(object.components)) {
      for (const component of components) {
        referenceCount += 1;
        if (component.kind === 'object') {
          if (!document.objects[component.objectId]) {
            errors.push(
              error(
                'COMPONENT_NOT_FOUND',
                `Component object "${component.objectId}" does not exist`,
                `objects.${objectId}.components.${property}`
              )
            );
            continue;
          }
          const currentOwner = owners.get(component.objectId);
          if (currentOwner && currentOwner !== objectId) {
            errors.push(
              error(
                'MULTIPLE_COMPONENT_OWNERS',
                `Object "${component.objectId}" is composed by both "${currentOwner}" and "${objectId}"`,
                `objects.${objectId}.components.${property}`
              )
            );
          } else {
            owners.set(component.objectId, objectId);
          }
        } else {
          validateReference(
            component.objectRef,
            document,
            errors,
            `objects.${objectId}.components`
          );
        }
      }
    }

    for (const [property, references] of Object.entries(object.references)) {
      for (const reference of references) {
        referenceCount += 1;
        validateReference(
          reference,
          document,
          errors,
          `objects.${objectId}.references.${property}`
        );
      }
    }
  }

  for (const rootId of document.rootObjectIds) {
    if (owners.has(rootId)) {
      errors.push(
        error(
          'ROOT_HAS_OWNER',
          `Root object "${rootId}" is also owned as a component`,
          'rootObjectIds'
        )
      );
    }
  }

  const rootIds = new Set(document.rootObjectIds);
  for (const objectId of Object.keys(document.objects)) {
    if (!rootIds.has(objectId) && !owners.has(objectId)) {
      errors.push(
        error(
          'UNREACHABLE_OBJECT',
          `Object "${objectId}" is neither a root nor owned by a composition`,
          `objects.${objectId}`
        )
      );
    }
  }

  detectCompositionCycles(document, errors);

  if (document.profile === 'flowops-conceptual') {
    warnings.push(
      warning(
        'CONCEPTUAL_PROFILE',
        'Mermaid conversion describes conceptual connectivity; detailed P&ID topology and DEXPI class constraints still require engineering review.'
      )
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    objectCount: Object.keys(document.objects).length,
    referenceCount,
  };
}

function validateReference(
  reference: string,
  document: DexpiDocument,
  errors: DexpiDiagnostic[],
  path: string
): void {
  if (reference.startsWith('#')) {
    const id = reference.slice(1);
    if (!document.objects[id]) {
      errors.push(error('REFERENCE_NOT_FOUND', `Reference "${reference}" does not exist`, path));
    }
  } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(reference) && !document.objects[reference]) {
    errors.push(error('REFERENCE_NOT_FOUND', `Reference "${reference}" does not exist`, path));
  }
}

function validateDataValue(value: DexpiDataValue, path: string, errors: DexpiDiagnostic[]): void {
  if (typeof value === 'string') {
    if (INVALID_XML_CHARACTER.test(value)) {
      errors.push(
        error('INVALID_XML_CHARACTER', 'Value contains an XML 1.0 control character', path)
      );
    }
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (value.kind === 'datetime' && Number.isNaN(Date.parse(value.value))) {
    errors.push(error('INVALID_DATETIME', `Invalid date-time "${value.value}"`, path));
  }
  if (value.kind === 'aggregated') {
    for (const [property, values] of Object.entries(value.data)) {
      for (const nested of values) validateDataValue(nested, `${path}.${property}`, errors);
    }
  }
}

function detectCompositionCycles(document: DexpiDocument, errors: DexpiDiagnostic[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (objectId: string, trail: string[]): void => {
    if (visiting.has(objectId)) {
      errors.push(
        error('COMPOSITION_CYCLE', `Composition cycle: ${[...trail, objectId].join(' -> ')}`)
      );
      return;
    }
    if (visited.has(objectId)) return;
    visiting.add(objectId);
    const object = document.objects[objectId];
    if (object) {
      for (const components of Object.values(object.components)) {
        for (const component of components) {
          if (component.kind === 'object') visit(component.objectId, [...trail, objectId]);
        }
      }
    }
    visiting.delete(objectId);
    visited.add(objectId);
  };

  for (const rootId of document.rootObjectIds) visit(rootId, []);
  for (const objectId of Object.keys(document.objects)) visit(objectId, []);
}

function error(code: string, message: string, path?: string): DexpiDiagnostic {
  return { severity: 'error', code, message, path };
}

function warning(code: string, message: string, path?: string): DexpiDiagnostic {
  return { severity: 'warning', code, message, path };
}
