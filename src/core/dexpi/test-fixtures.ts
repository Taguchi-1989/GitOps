import {
  DEFAULT_DEXPI_IMPORTS,
  DEXPI_DOCUMENT_SCHEMA_VERSION,
  DEXPI_STANDARD_VERSION,
  DexpiDocument,
} from './types';

export function sampleDexpiDocument(): DexpiDocument {
  return {
    schemaVersion: DEXPI_DOCUMENT_SCHEMA_VERSION,
    standard: { name: 'DEXPI', version: DEXPI_STANDARD_VERSION, serialization: 'DEXPI_XML' },
    profile: 'flowops-conceptual',
    model: {
      name: 'SamplePid',
      uri: 'urn:flowops:dexpi:sample',
      imports: [...DEFAULT_DEXPI_IMPORTS],
    },
    rootObjectIds: ['engineering_model'],
    objects: {
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
        components: {
          TaggedPlantItems: [
            { kind: 'object', objectId: 'tank_1' },
            { kind: 'object', objectId: 'pump_1' },
          ],
        },
        references: {},
      },
      tank_1: {
        id: 'tank_1',
        type: 'Plant/ProcessEquipment.Tank',
        data: { TagName: ['T-101 & feed'], Capacity: [{ kind: 'double', value: 10.5 }] },
        components: {},
        references: { FlowTo: ['#pump_1'] },
      },
      pump_1: {
        id: 'pump_1',
        type: 'Plant/ProcessEquipment.Pump',
        data: {
          TagName: ['P-101'],
          Status: [{ kind: 'data-reference', value: 'Plant/Enumerations.Test.Success' }],
        },
        components: {},
        references: {},
      },
    },
    metadata: { sourceFormat: 'test' },
  };
}
