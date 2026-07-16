import {
  DEFAULT_DEXPI_IMPORTS,
  DEXPI_DOCUMENT_SCHEMA_VERSION,
  DEXPI_MAX_INPUT_LENGTH,
  DEXPI_STANDARD_VERSION,
  DexpiDataValue,
  DexpiDocument,
  DexpiDocumentSchema,
  DexpiObject,
} from './types';

export class DexpiMermaidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DexpiMermaidError';
  }
}

export interface MermaidImportResult {
  document: DexpiDocument;
  warnings: string[];
}

interface MermaidNode {
  id: string;
  label: string;
  className?: string;
}

export function importDexpiMermaid(content: string): MermaidImportResult {
  if (!content.trim()) throw new DexpiMermaidError('Mermaid content is empty');
  if (content.length > DEXPI_MAX_INPUT_LENGTH) {
    throw new DexpiMermaidError('Mermaid content exceeds the 5 MB input limit');
  }

  const lines = content.split(/\r?\n/);
  if (!lines.some(line => /^\s*(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/i.test(line))) {
    throw new DexpiMermaidError('A Mermaid flowchart/graph header is required');
  }

  const warnings: string[] = [];
  const nodes = new Map<string, MermaidNode>();
  const types = new Map<string, string>();
  const data = new Map<string, Record<string, DexpiDataValue[]>>();
  const edges: Array<{ from: string; to: string; label?: string }> = [];
  let modelName = 'FlowOpsDexpiModel';
  let modelUri = 'urn:flowops:dexpi:mermaid';

  for (const line of lines) {
    const modelDirective = line.match(/^\s*%%\s*dexpi:model\s+name="([^"]+)"\s+uri="([^"]+)"\s*$/i);
    if (modelDirective) {
      modelName = toDexpiName(modelDirective[1], 'FlowOpsDexpiModel');
      modelUri = modelDirective[2];
      continue;
    }

    const typeDirective = line.match(/^\s*%%\s*dexpi:type\s+([A-Za-z_][A-Za-z0-9_]*)\s+(\S+)\s*$/i);
    if (typeDirective) {
      types.set(typeDirective[1], typeDirective[2]);
      continue;
    }

    const dataDirective = line.match(/^\s*%%\s*dexpi:data\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
    if (dataDirective) {
      try {
        const raw = JSON.parse(dataDirective[2]) as Record<string, unknown>;
        data.set(dataDirective[1], normalizeDirectiveData(raw));
      } catch {
        throw new DexpiMermaidError(`Invalid dexpi:data JSON for node "${dataDirective[1]}"`);
      }
      continue;
    }

    const edge = parseEdge(line);
    if (edge) {
      edges.push(edge);
      continue;
    }

    const node = parseNode(line);
    if (node) nodes.set(node.id, node);
  }

  for (const edge of edges) {
    if (!nodes.has(edge.from)) nodes.set(edge.from, { id: edge.from, label: edge.from });
    if (!nodes.has(edge.to)) nodes.set(edge.to, { id: edge.to, label: edge.to });
  }
  if (nodes.size === 0) throw new DexpiMermaidError('No Mermaid nodes were found');

  const objects: Record<string, DexpiObject> = {
    engineering_model: {
      id: 'engineering_model',
      type: 'Core/EngineeringModel',
      data: {},
      components: { ConceptualModel: [{ kind: 'object', objectId: 'plant_model' }] },
      references: {},
    },
    plant_model: {
      id: 'plant_model',
      type: 'Plant/PlantModel',
      data: {},
      components: { TaggedPlantItems: [] },
      references: {},
    },
  };

  for (const node of nodes.values()) {
    const id = toDexpiName(node.id, 'item');
    if (id !== node.id) warnings.push(`Node id "${node.id}" was normalized to "${id}".`);
    const objectType = types.get(node.id) ?? classToDexpiType(node.className);
    if (!types.has(node.id) && !node.className) {
      warnings.push(
        `Node "${node.id}" has no dexpi:type directive or known class; FlowOpsGenericPlantItem was used.`
      );
    }
    objects[id] = {
      id,
      type: objectType,
      data: data.get(node.id) ?? { TagName: [node.label] },
      components: {},
      references: {},
    };
    objects.plant_model.components.TaggedPlantItems.push({ kind: 'object', objectId: id });
  }

  for (const edge of edges) {
    const from = toDexpiName(edge.from, 'item');
    const to = toDexpiName(edge.to, 'item');
    if (!objects[from] || !objects[to]) continue;
    objects[from].references.FlowTo = [...(objects[from].references.FlowTo ?? []), `#${to}`];
    if (edge.label) {
      objects[from].data.FlowLabels = [
        ...(objects[from].data.FlowLabels ?? []),
        `${edge.label}: ${from} -> ${to}`,
      ];
    }
  }

  const document = DexpiDocumentSchema.parse({
    schemaVersion: DEXPI_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'DEXPI', version: DEXPI_STANDARD_VERSION, serialization: 'DEXPI_XML' },
    profile: 'flowops-conceptual',
    model: { name: modelName, uri: modelUri, imports: [...DEFAULT_DEXPI_IMPORTS] },
    rootObjectIds: ['engineering_model'],
    objects,
    metadata: { sourceFormat: 'mermaid', conversionProfile: 'conceptual-connectivity' },
  });

  warnings.push(
    'Mermaid edges were mapped to the FlowOpsConnectivity extension. Convert them to native DEXPI piping/instrumentation topology before detailed engineering use.'
  );
  return { document, warnings };
}

export function exportDexpiMermaid(document: DexpiDocument): string {
  const lines = [
    'flowchart LR',
    `  %% dexpi:model name="${document.model.name}" uri="${document.model.uri}"`,
  ];
  const visibleObjects = Object.values(document.objects).filter(
    object => !['Core/EngineeringModel', 'Plant/PlantModel'].includes(object.type)
  );

  for (const object of visibleObjects) {
    const label = objectLabel(object);
    lines.push(`  ${object.id}["${escapeMermaid(label)}"]:::${typeClass(object.type)}`);
    lines.push(`  %% dexpi:type ${object.id} ${object.type}`);
    if (Object.keys(object.data).length > 0) {
      lines.push(`  %% dexpi:data ${object.id} ${JSON.stringify(object.data)}`);
    }
  }

  for (const object of visibleObjects) {
    for (const [property, references] of Object.entries(object.references)) {
      for (const reference of references) {
        const target = internalReferenceId(reference);
        if (target && document.objects[target] && visibleObjects.some(item => item.id === target)) {
          lines.push(`  ${object.id} -->|"${escapeMermaid(property)}"| ${target}`);
        }
      }
    }
  }

  lines.push('  classDef equipment fill:#dbeafe,stroke:#2563eb,color:#1e3a8a');
  lines.push('  classDef piping fill:#dcfce7,stroke:#16a34a,color:#14532d');
  lines.push('  classDef instrumentation fill:#fef3c7,stroke:#d97706,color:#78350f');
  lines.push('  classDef generic fill:#f3f4f6,stroke:#6b7280,color:#111827');
  return lines.join('\n');
}

function parseNode(line: string): MermaidNode | null {
  if (/^\s*(?:flowchart|graph|classDef|class|linkStyle|style|subgraph|end)\b/i.test(line)) {
    return null;
  }
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*([\[({].*)$/);
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

function parseEdge(line: string): { from: string; to: string; label?: string } | null {
  const match = line.match(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:-->|-\.->|==>)\s*(?:\|"?([^|"]+)"?\|\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*$/
  );
  if (!match) return null;
  return { from: match[1], to: match[3], ...(match[2]?.trim() ? { label: match[2].trim() } : {}) };
}

function normalizeDirectiveData(raw: Record<string, unknown>): Record<string, DexpiDataValue[]> {
  const result: Record<string, DexpiDataValue[]> = {};
  for (const [property, value] of Object.entries(raw)) {
    result[property] = (Array.isArray(value) ? value : [value]) as DexpiDataValue[];
  }
  return result;
}

function classToDexpiType(className?: string): string {
  switch (className?.toLowerCase()) {
    case 'pump':
      return 'Plant/ProcessEquipment.Pump';
    case 'tank':
      return 'Plant/ProcessEquipment.Tank';
    case 'valve':
      return 'Plant/Piping.GlobeValve';
    case 'piping':
    case 'pipe':
      return 'Plant/Piping.PipingNetworkSegment';
    case 'instrumentation':
    case 'instrument':
      return 'Plant/Instrumentation.ProcessInstrumentationFunction';
    default:
      return '/FlowOpsGenericPlantItem';
  }
}

function typeClass(type: string): string {
  if (type.includes('/Piping.')) return 'piping';
  if (type.includes('/Instrumentation.')) return 'instrumentation';
  if (type.includes('/ProcessEquipment.')) return 'equipment';
  return 'generic';
}

function objectLabel(object: DexpiObject): string {
  const candidates = [
    'TagName',
    'EquipmentTagName',
    'LineNumber',
    'InstrumentationLoopFunctionNumber',
  ];
  for (const property of candidates) {
    const value = object.data[property]?.[0];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return object.name ?? `${object.id} / ${object.type.split(/[./]/).pop()}`;
}

function internalReferenceId(reference: string): string | null {
  if (reference.startsWith('#')) return reference.slice(1);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(reference)) return reference;
  return null;
}

function toDexpiName(value: string, fallback: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
  const withStart = /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
  return withStart || fallback;
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ');
}
