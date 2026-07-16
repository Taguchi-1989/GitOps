import { describe, expect, it } from 'vitest';
import { exportDexpiMermaid, importDexpiMermaid } from './mermaid';

const MERMAID = `flowchart LR
  tank_1["T-101 / Feed tank"]:::tank
  pump_1["P-101 / Feed pump"]:::pump
  tank_1 -->|"ProcessFlow"| pump_1
  %% dexpi:model name="FeedSystem" uri="urn:plant:feed-system"
  %% dexpi:type pump_1 Plant/ProcessEquipment.Pump
  %% dexpi:data pump_1 {"TagName":["P-101"],"DesignPower":[12.5]}`;

describe('DeXPI Mermaid bridge', () => {
  it('creates canonical JSON from annotated Mermaid', () => {
    const result = importDexpiMermaid(MERMAID);
    expect(result.document.model).toMatchObject({
      name: 'FeedSystem',
      uri: 'urn:plant:feed-system',
    });
    expect(result.document.objects.tank_1.type).toBe('Plant/ProcessEquipment.Tank');
    expect(result.document.objects.pump_1.data.DesignPower).toEqual([12.5]);
    expect(result.document.objects.tank_1.references.FlowTo).toEqual(['#pump_1']);
    expect(result.warnings.some(item => item.includes('FlowOpsConnectivity'))).toBe(true);
  });

  it('renders canonical JSON back to annotated Mermaid', () => {
    const document = importDexpiMermaid(MERMAID).document;
    const rendered = exportDexpiMermaid(document);
    expect(rendered).toContain('flowchart LR');
    expect(rendered).toContain('%% dexpi:type pump_1 Plant/ProcessEquipment.Pump');
    expect(rendered).toContain('tank_1 -->|"FlowTo"| pump_1');
  });

  it('uses an explicit local extension for untyped nodes and reports the assumption', () => {
    const result = importDexpiMermaid('flowchart LR\n  unknown["Unknown item"]');
    expect(result.document.objects.unknown.type).toBe('/FlowOpsGenericPlantItem');
    expect(result.warnings.some(item => item.includes('no dexpi:type'))).toBe(true);
  });

  it('rejects non-flowchart Mermaid input', () => {
    expect(() => importDexpiMermaid('sequenceDiagram\n  A->>B: hello')).toThrow(
      'A Mermaid flowchart/graph header is required'
    );
  });
});
