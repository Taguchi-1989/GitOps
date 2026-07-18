import { describe, expect, it } from 'vitest';
import { createBpmnDocument, createRichBpmnDocument } from './test-fixtures';
import { exportBpmnXml, importBpmnXml } from './xml';

const MINIMAL_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="urn:example:minimal">
  <bpmn:process id="Process_1" name="Minimal" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start"/>
    <bpmn:userTask id="Task_1" name="Review"/>
    <bpmn:endEvent id="End_1" name="End"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="80" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="116" y="118"/>
        <di:waypoint x="200" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe('BPMN XML conversion', () => {
  it('imports BPMN 2.0 process and DI data', () => {
    const imported = importBpmnXml(MINIMAL_BPMN);
    expect(imported.document.processes[0].nodes.Task_1.type).toBe('userTask');
    expect(imported.document.diagrams[0].shapes[0].bounds.width).toBe(36);
  });

  it('exports valid-shaped BPMN XML and round-trips it', () => {
    const xml = exportBpmnXml(createBpmnDocument());
    expect(xml).toContain('<bpmn:definitions');
    expect(xml).toContain('<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">');
    expect(xml).toContain('<bpmndi:BPMNDiagram');
    const imported = importBpmnXml(xml);
    expect(imported.document.processes[0].nodes.Review_Order.type).toBe('userTask');
    expect(imported.document.processes[0].sequenceFlows.Flow_Approved.conditionExpression).toBe(
      '${approved}'
    );
  });

  it('rejects DTD declarations', () => {
    expect(() => importBpmnXml('<!DOCTYPE definitions [<!ENTITY x "y">]><definitions/>')).toThrow(
      /DTD/
    );
  });

  it('warns when vendor extension elements are present', () => {
    const xml = MINIMAL_BPMN.replace(
      '<bpmn:userTask id="Task_1" name="Review"/>',
      '<bpmn:userTask id="Task_1" name="Review"><bpmn:extensionElements><vendor:config xmlns:vendor="urn:vendor"/></bpmn:extensionElements></bpmn:userTask>'
    );
    expect(importBpmnXml(xml).warnings.some(item => item.includes('extensionElements'))).toBe(true);
  });

  it('round-trips globals, collaboration, nested lanes, subprocesses, events, and explicit DI', () => {
    const document = createRichBpmnDocument();
    const xml = exportBpmnXml(document);
    expect(xml).toContain('<bpmn:message id="Message_Order"');
    expect(xml).toContain('<bpmn:childLaneSet');
    expect(xml).toContain('<bpmn:subProcess id="SubProcess_Pack"');
    expect(xml).toContain('<bpmn:timerEventDefinition>');
    expect(xml).toContain('<bpmn:collaboration id="Collaboration_Order"');
    expect(xml).toContain('isHorizontal="false"');
    const imported = importBpmnXml(xml);
    expect(imported.document.globalElements).toHaveLength(4);
    expect(imported.document.processes[0].nodes.Task_Pack.parentSubProcessId).toBe(
      'SubProcess_Pack'
    );
    expect(imported.document.processes[0].lanes.Lane_Reviewer.parentLaneId).toBe('Lane_All');
    expect(imported.document.collaborations[0].messageFlows.MessageFlow_Order.messageRef).toBe(
      'Message_Order'
    );
  });

  it('imports unsupported elements with an explicit warning', () => {
    const xml = MINIMAL_BPMN.replace(
      '<bpmn:endEvent id="End_1" name="End"/>',
      '<bpmn:dataObjectReference id="Data_1" dataObjectRef="Object_1"/><bpmn:endEvent id="End_1" name="End"/>'
    );
    expect(importBpmnXml(xml).warnings.some(item => item.includes('dataObjectReference'))).toBe(
      true
    );
  });

  it('rejects missing definitions, missing processes, missing attributes, and invalid diagrams', () => {
    expect(() => importBpmnXml('<root/>')).toThrow(/definitions root/);
    expect(() =>
      importBpmnXml(
        '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="urn:test"/>'
      )
    ).toThrow(/process is required/);
    expect(() =>
      importBpmnXml(
        '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="urn:test"><bpmn:process><bpmn:task id="T"/></bpmn:process></bpmn:definitions>'
      )
    ).toThrow(/requires attribute "id"/);
    expect(() =>
      importBpmnXml(
        MINIMAL_BPMN.replace(
          '<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">',
          '<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="Broken" bpmnElement="Task_1"/>'
        )
      )
    ).toThrow(/Bounds/);
  });

  it('rejects duplicate nodes, duplicate flows, missing refs, and invalid diagram numbers', () => {
    expect(() =>
      importBpmnXml(
        MINIMAL_BPMN.replace(
          '<bpmn:userTask id="Task_1" name="Review"/>',
          '<bpmn:userTask id="Task_1"/><bpmn:userTask id="Task_1"/>'
        )
      )
    ).toThrow(/Duplicate BPMN node/);
    expect(() =>
      importBpmnXml(
        MINIMAL_BPMN.replace(
          '<bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1"/>',
          '<bpmn:sequenceFlow id="Flow_1" sourceRef="Task_1" targetRef="End_1"/>'
        )
      )
    ).toThrow(/Duplicate BPMN sequence-flow/);
    expect(() => importBpmnXml(MINIMAL_BPMN.replace('sourceRef="Start_1"', ''))).toThrow(
      /sourceRef/
    );
    expect(() => importBpmnXml(MINIMAL_BPMN.replace('width="36"', 'width="not-a-number"'))).toThrow(
      /must be numeric/
    );
  });

  it('rejects empty, oversized, and semantically invalid XML and export input', () => {
    expect(() => importBpmnXml(' ')).toThrow(/empty/);
    expect(() => importBpmnXml('x'.repeat(5_000_001))).toThrow(/5 MB/);
    expect(() =>
      importBpmnXml(MINIMAL_BPMN.replace('targetRef="End_1"', 'targetRef="Missing"'))
    ).toThrow(/does not exist/);
    const document = createBpmnDocument();
    document.processes[0].sequenceFlows.Flow_End.targetRef = 'Missing';
    expect(() => exportBpmnXml(document)).toThrow(/does not exist/);
  });
});
