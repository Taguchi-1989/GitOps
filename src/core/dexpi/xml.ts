import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  DEXPI_DOCUMENT_SCHEMA_VERSION,
  DEXPI_MAX_INPUT_LENGTH,
  DEXPI_STANDARD_VERSION,
  DexpiComponent,
  DexpiDataValue,
  DexpiDocument,
  DexpiDocumentSchema,
  DexpiObject,
} from './types';
import { validateDexpiDocument } from './validate';

type XmlNode = Record<string, unknown>;

export class DexpiXmlError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DexpiXmlError';
  }
}

export interface DexpiXmlImportResult {
  document: DexpiDocument;
  warnings: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: false,
  allowBooleanAttributes: false,
  maxNestedTags: 200,
  isArray: (name: string) =>
    ['Import', 'Object', 'ObjectReference', 'Components', 'Data', 'References'].includes(name),
});

export function importDexpiXml(xml: string): DexpiXmlImportResult {
  if (!xml.trim()) throw new DexpiXmlError('EMPTY_XML', 'DeXPI XML is empty');
  if (xml.length > DEXPI_MAX_INPUT_LENGTH) {
    throw new DexpiXmlError('XML_TOO_LARGE', 'DeXPI XML exceeds the 5 MB input limit');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new DexpiXmlError('DTD_NOT_ALLOWED', 'DTD and entity declarations are not allowed');
  }
  if (/^\s*(?:<\?xml[^>]*>\s*)?<PlantModel\b/i.test(xml)) {
    throw new DexpiXmlError(
      'PROTEUS_XML_UNSUPPORTED',
      'DEXPI 1.4 Proteus XML was detected. This endpoint accepts DEXPI XML 2.0 with a <Model> root.'
    );
  }

  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) {
    throw new DexpiXmlError(
      'XML_NOT_WELL_FORMED',
      `XML is not well formed: ${validation.err.msg} at line ${validation.err.line}`
    );
  }

  let parsed: XmlNode;
  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    throw new DexpiXmlError(
      'XML_PARSE_FAILED',
      error instanceof Error ? error.message : 'Failed to parse DeXPI XML'
    );
  }

  const model = asNode(parsed.Model);
  if (!model) {
    throw new DexpiXmlError('MODEL_ROOT_REQUIRED', 'DEXPI XML 2.0 requires a <Model> root');
  }

  const warnings: string[] = [];
  const objects: Record<string, DexpiObject> = {};
  let generatedId = 0;
  let anonymousIdCount = 0;

  const nextId = (candidate?: string): { id: string; generated: boolean } => {
    if (candidate && /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) && !objects[candidate]) {
      return { id: candidate, generated: false };
    }
    let id: string;
    do {
      generatedId += 1;
      id = `generated_${String(generatedId).padStart(4, '0')}`;
    } while (objects[id]);
    if (candidate) {
      warnings.push(`Invalid or duplicate XML id "${candidate}" was replaced with "${id}".`);
    } else {
      anonymousIdCount += 1;
    }
    return { id, generated: true };
  };

  const parseObject = (node: XmlNode): string => {
    const assigned = nextId(attribute(node, 'id') ?? attribute(node, 'name'));
    const object: DexpiObject = {
      id: assigned.id,
      type: attribute(node, 'type') ?? '/FlowOpsGenericPlantItem',
      data: {},
      components: {},
      references: {},
      ...(attribute(node, 'name') ? { name: attribute(node, 'name') } : {}),
      ...(assigned.generated ? { generatedId: true } : {}),
    };
    objects[object.id] = object;

    for (const dataNode of asArray(node.Data)) {
      const property = attribute(dataNode, 'property');
      if (!property) {
        warnings.push(`Data on object "${object.id}" was skipped because property is missing.`);
        continue;
      }
      const values = parseDataValues(dataNode, warnings, `objects.${object.id}.data.${property}`);
      object.data[property] = [...(object.data[property] ?? []), ...values];
    }

    for (const componentNode of asArray(node.Components)) {
      const property = attribute(componentNode, 'property');
      if (!property) {
        warnings.push(
          `Components on object "${object.id}" were skipped because property is missing.`
        );
        continue;
      }
      const components: DexpiComponent[] = [];
      for (const child of asArray(componentNode.Object)) {
        components.push({ kind: 'object', objectId: parseObject(child) });
      }
      for (const reference of asArray(componentNode.ObjectReference)) {
        const objectRef = attribute(reference, 'object');
        if (objectRef) components.push({ kind: 'reference', objectRef });
      }
      object.components[property] = [...(object.components[property] ?? []), ...components];
    }

    for (const referencesNode of asArray(node.References)) {
      const property = attribute(referencesNode, 'property');
      const refs = attribute(referencesNode, 'objects');
      if (!property || !refs) continue;
      object.references[property] = [
        ...(object.references[property] ?? []),
        ...refs.split(/\s+/).filter(Boolean),
      ];
    }

    return object.id;
  };

  const rootObjectIds = asArray(model.Object).map(parseObject);
  if (rootObjectIds.length === 0) {
    throw new DexpiXmlError('ROOT_OBJECT_REQUIRED', 'DEXPI Model must contain at least one Object');
  }
  if (anonymousIdCount > 0) {
    warnings.push(
      `${anonymousIdCount} object(s) without an XML id were assigned deterministic generated IDs.`
    );
  }

  const document = DexpiDocumentSchema.parse({
    schemaVersion: DEXPI_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'DEXPI', version: DEXPI_STANDARD_VERSION, serialization: 'DEXPI_XML' },
    profile: 'dexpi-2.0-structural',
    model: {
      name: attribute(model, 'name') ?? 'ImportedDexpiModel',
      uri: attribute(model, 'uri') ?? 'urn:flowops:dexpi:imported',
      imports: asArray(model.Import).map(item => ({
        prefix: attribute(item, 'prefix') ?? 'Unknown',
        source: attribute(item, 'source') ?? 'urn:flowops:dexpi:missing-import',
      })),
    },
    rootObjectIds,
    objects,
    metadata: { sourceFormat: 'dexpi-xml-2.0' },
  });

  const documentValidation = validateDexpiDocument(document);
  warnings.push(...documentValidation.warnings.map(item => item.message));
  if (!documentValidation.valid) {
    throw new DexpiXmlError(
      'DEXPI_DOCUMENT_INVALID',
      documentValidation.errors.map(item => item.message).join('; ')
    );
  }

  return { document, warnings };
}

export function exportDexpiXml(input: unknown): string {
  const document = DexpiDocumentSchema.parse(input);
  const validation = validateDexpiDocument(document);
  if (!validation.valid) {
    throw new DexpiXmlError(
      'DEXPI_DOCUMENT_INVALID',
      validation.errors.map(item => item.message).join('; ')
    );
  }

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(
    `<Model name="${escapeAttribute(document.model.name)}" uri="${escapeAttribute(document.model.uri)}">`
  );
  for (const item of document.model.imports) {
    lines.push(
      `  <Import prefix="${escapeAttribute(item.prefix)}" source="${escapeAttribute(item.source)}"/>`
    );
  }

  const usesGenericType = Object.values(document.objects).some(
    object => object.type === '/FlowOpsGenericPlantItem'
  );
  const usesFlowTo = Object.values(document.objects).some(
    object => object.references.FlowTo?.length
  );
  if (usesGenericType) {
    lines.push(
      '  <ConcreteClass name="FlowOpsGenericPlantItem" superTypes="Plant/ProcessEquipment.TaggedPlantItem">'
    );
    lines.push(
      '    <DataProperty name="TagName" isOrdered="false" isUnique="false" lower="0" upper="1">'
    );
    lines.push('      <DataTypeReference type="Builtin/String"/>');
    lines.push('    </DataProperty>');
    lines.push('  </ConcreteClass>');
  }
  if (usesFlowTo) {
    lines.push('  <ClassExtension name="FlowOpsConnectivity" baseType="Core/ConceptualObject">');
    lines.push(
      '    <ReferenceProperty name="FlowTo" isOrdered="false" isUnique="true" lower="0" oppositeLower="0">'
    );
    lines.push('      <ClassReference type="Core/ConceptualObject"/>');
    lines.push('    </ReferenceProperty>');
    lines.push('  </ClassExtension>');
  }

  const rendered = new Set<string>();
  for (const rootId of document.rootObjectIds) {
    renderObject(document.objects[rootId], document, lines, 1, rendered);
  }
  lines.push('</Model>');
  return `${lines.join('\n')}\n`;
}

function renderObject(
  object: DexpiObject,
  document: DexpiDocument,
  lines: string[],
  level: number,
  rendered: Set<string>
): void {
  if (!object || rendered.has(object.id)) return;
  rendered.add(object.id);
  const indent = '  '.repeat(level);
  const attributes = [
    `id="${escapeAttribute(object.id)}"`,
    object.name ? `name="${escapeAttribute(object.name)}"` : '',
    `type="${escapeAttribute(object.type)}"`,
  ]
    .filter(Boolean)
    .join(' ');
  lines.push(`${indent}<Object ${attributes}>`);

  for (const [property, values] of Object.entries(object.data)) {
    lines.push(`${indent}  <Data property="${escapeAttribute(property)}">`);
    for (const value of values) renderDataValue(value, lines, level + 2);
    lines.push(`${indent}  </Data>`);
  }

  for (const [property, components] of Object.entries(object.components)) {
    lines.push(`${indent}  <Components property="${escapeAttribute(property)}">`);
    for (const component of components) {
      if (component.kind === 'object') {
        renderObject(document.objects[component.objectId], document, lines, level + 2, rendered);
      } else {
        lines.push(
          `${indent}    <ObjectReference object="${escapeAttribute(normalizeReference(component.objectRef))}"/>`
        );
      }
    }
    lines.push(`${indent}  </Components>`);
  }

  for (const [property, references] of Object.entries(object.references)) {
    const refs = references.map(normalizeReference).join(' ');
    lines.push(
      `${indent}  <References property="${escapeAttribute(property)}" objects="${escapeAttribute(refs)}"/>`
    );
  }
  lines.push(`${indent}</Object>`);
}

function renderDataValue(value: DexpiDataValue, lines: string[], level: number): void {
  const indent = '  '.repeat(level);
  if (typeof value === 'string') lines.push(`${indent}<String>${escapeText(value)}</String>`);
  else if (typeof value === 'number') lines.push(`${indent}<Double>${value}</Double>`);
  else if (typeof value === 'boolean') lines.push(`${indent}<Boolean>${value}</Boolean>`);
  else if (value.kind === 'integer') lines.push(`${indent}<Integer>${value.value}</Integer>`);
  else if (value.kind === 'double') lines.push(`${indent}<Double>${value.value}</Double>`);
  else if (value.kind === 'datetime')
    lines.push(`${indent}<DateTime>${escapeText(value.value)}</DateTime>`);
  else if (value.kind === 'data-reference') {
    lines.push(`${indent}<DataReference data="${escapeAttribute(value.value)}"/>`);
  } else if (value.kind === 'undefined') lines.push(`${indent}<Undefined/>`);
  else {
    lines.push(`${indent}<AggregatedDataValue type="${escapeAttribute(value.type)}">`);
    for (const [property, values] of Object.entries(value.data)) {
      lines.push(`${indent}  <Data property="${escapeAttribute(property)}">`);
      for (const nested of values) renderDataValue(nested, lines, level + 2);
      lines.push(`${indent}  </Data>`);
    }
    lines.push(`${indent}</AggregatedDataValue>`);
  }
}

function parseDataValues(node: XmlNode, warnings: string[], path: string): DexpiDataValue[] {
  const values: DexpiDataValue[] = [];
  for (const value of asArray(node.String)) values.push(stringValue(value));
  for (const value of asArray(node.Integer)) {
    const parsed = Number(stringValue(value));
    if (Number.isInteger(parsed)) values.push({ kind: 'integer', value: parsed });
    else warnings.push(`${path}: invalid Integer was skipped.`);
  }
  for (const value of asArray(node.Double)) {
    const parsed = Number(stringValue(value));
    if (Number.isFinite(parsed)) values.push({ kind: 'double', value: parsed });
    else warnings.push(`${path}: invalid Double was skipped.`);
  }
  for (const value of asArray(node.Boolean)) {
    const parsed = stringValue(value).trim().toLowerCase();
    if (parsed === 'true' || parsed === '1') values.push(true);
    else if (parsed === 'false' || parsed === '0') values.push(false);
    else warnings.push(`${path}: invalid Boolean was skipped.`);
  }
  for (const value of asArray(node.DateTime)) {
    values.push({ kind: 'datetime', value: stringValue(value) });
  }
  for (const value of asArray(node.DataReference)) {
    const reference = typeof value === 'object' ? attribute(value, 'data') : undefined;
    if (reference) values.push({ kind: 'data-reference', value: reference });
  }
  for (const _value of asArray(node.Undefined)) values.push({ kind: 'undefined' });
  for (const aggregatedNode of asArray(node.AggregatedDataValue)) {
    const data: Record<string, DexpiDataValue[]> = {};
    for (const childData of asArray(aggregatedNode.Data)) {
      const property = attribute(childData, 'property');
      if (property) data[property] = parseDataValues(childData, warnings, `${path}.${property}`);
    }
    values.push({
      kind: 'aggregated',
      type: attribute(aggregatedNode, 'type') ?? 'Builtin/Undefined',
      data,
    });
  }
  return values;
}

function asNode(value: unknown): XmlNode | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as XmlNode) : null;
}

function asArray(value: unknown): XmlNode[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(item =>
      typeof item === 'object' && item !== null ? (item as XmlNode) : ({ '#text': item } as XmlNode)
    )
    .filter(Boolean);
}

function attribute(node: XmlNode, name: string): string | undefined {
  const value = node[`@_${name}`];
  return typeof value === 'string'
    ? decodePredefinedEntities(value)
    : value === undefined
      ? undefined
      : String(value);
}

function stringValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return decodePredefinedEntities(String(value));
  }
  if (value && typeof value === 'object' && '#text' in value) {
    return decodePredefinedEntities(String((value as XmlNode)['#text'] ?? ''));
  }
  return '';
}

function decodePredefinedEntities(value: string): string {
  return value
    .replace(/&#x([0-9A-Fa-f]+);/g, (entity, digits: string) =>
      decodeNumericEntity(entity, Number.parseInt(digits, 16))
    )
    .replace(/&#([0-9]+);/g, (entity, digits: string) =>
      decodeNumericEntity(entity, Number.parseInt(digits, 10))
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function decodeNumericEntity(entity: string, codePoint: number): string {
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return entity;
  }
  return String.fromCodePoint(codePoint);
}

function normalizeReference(reference: string): string {
  if (reference.startsWith('#') || reference.includes('/')) return reference;
  return `#${reference}`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
