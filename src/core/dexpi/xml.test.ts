import { describe, expect, it } from 'vitest';
import { DEXPI_MAX_INPUT_LENGTH } from './types';
import { exportDexpiXml, importDexpiXml } from './xml';
import { sampleDexpiDocument } from './test-fixtures';

describe('DeXPI XML 2.0 import/export', () => {
  it('exports canonical JSON and imports it without losing objects or typed values', () => {
    const source = sampleDexpiDocument();
    const xml = exportDexpiXml(source);
    expect(xml).toContain('<Model name="SamplePid" uri="urn:flowops:dexpi:sample">');
    expect(xml).toContain('<Object id="tank_1" type="Plant/ProcessEquipment.Tank">');
    expect(xml).toContain('<String>T-101 &amp; feed</String>');
    expect(xml).toContain('<Double>10.5</Double>');
    expect(xml).toContain('objects="#pump_1"');

    const imported = importDexpiXml(xml);
    expect(Object.keys(imported.document.objects)).toEqual(
      expect.arrayContaining(['engineering_model', 'plant_model', 'tank_1', 'pump_1'])
    );
    expect(imported.document.objects.tank_1.data.TagName).toEqual(['T-101 & feed']);
    expect(imported.document.objects.tank_1.data.Capacity).toEqual([
      { kind: 'double', value: 10.5 },
    ]);
    expect(imported.document.objects.tank_1.references.FlowTo).toEqual(['#pump_1']);
  });

  it('imports aggregated values and creates deterministic ids for anonymous objects', () => {
    const xml = `<Model name="Imported" uri="urn:test">
      <Import prefix="Core" source="https://data.dexpi.org/models/2.0.0/Core.xml"/>
      <Object type="Core/EngineeringModel">
        <Data property="Description">
          <AggregatedDataValue type="Core/DataTypes.MultiLanguageString">
            <Data property="Value"><String>hello</String></Data>
          </AggregatedDataValue>
        </Data>
      </Object>
    </Model>`;
    const result = importDexpiXml(xml);
    expect(result.document.rootObjectIds).toEqual(['generated_0001']);
    expect(result.document.objects.generated_0001.data.Description[0]).toEqual({
      kind: 'aggregated',
      type: 'Core/DataTypes.MultiLanguageString',
      data: { Value: ['hello'] },
    });
    expect(result.warnings.some(item => item.includes('without an XML id'))).toBe(true);
  });

  it('decodes predefined and numeric XML character references safely', () => {
    const xml = `<Model name="Imported" uri="urn:test">
      <Object id="root" type="Core/EngineeringModel">
        <Data property="Label"><String>A &amp; B &#x65E5;&#26412;</String></Data>
      </Object>
    </Model>`;
    expect(importDexpiXml(xml).document.objects.root.data.Label).toEqual(['A & B 日本']);
  });

  it.each([
    ['DTD', '<!DOCTYPE Model [<!ENTITY x "secret">]><Model name="x" uri="u"/>', 'DTD_NOT_ALLOWED'],
    ['Proteus', '<PlantModel><PlantInformation/></PlantModel>', 'PROTEUS_XML_UNSUPPORTED'],
    ['malformed XML', '<Model>', 'XML_NOT_WELL_FORMED'],
  ])('rejects %s input', (_name, xml, expectedCode) => {
    expect(() => importDexpiXml(xml)).toThrowError(expect.objectContaining({ code: expectedCode }));
  });

  it('rejects oversized XML before parsing', () => {
    expect(() =>
      importDexpiXml(`<Model>${'x'.repeat(DEXPI_MAX_INPUT_LENGTH)}</Model>`)
    ).toThrowError(expect.objectContaining({ code: 'XML_TOO_LARGE' }));
  });
});
