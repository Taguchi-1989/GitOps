import { describe, expect, it } from 'vitest';
import { exportBpmnMermaid, importBpmnMermaid } from './mermaid';
import { createBpmnDocument, createRichBpmnDocument } from './test-fixtures';

const SAMPLE = `flowchart LR
  start(("Request received")):::start
  review["Review request"]:::user
  decision{"Approved?"}:::exclusive
  finish(("Completed")):::end
  start --> review
  review --> decision
  decision -->|"yes"| finish

  %% bpmn:definitions id="Definitions_Request" namespace="urn:example:request"
  %% bpmn:process id="Process_Request" name="Request approval" executable="false"
  %% bpmn:node id="start" process="Process_Request" type="startEvent" name="Request received"
  %% bpmn:node id="review" process="Process_Request" type="userTask" name="Review request"
  %% bpmn:node id="decision" process="Process_Request" type="exclusiveGateway" name="Approved?"
  %% bpmn:node id="finish" process="Process_Request" type="endEvent" name="Completed"
  %% bpmn:flow id="Flow_Start" process="Process_Request" source="start" target="review"`;

describe('BPMN Mermaid conversion', () => {
  it('imports annotated Mermaid as conceptual BPMN', () => {
    const imported = importBpmnMermaid(SAMPLE);
    expect(imported.document.profile).toBe('flowops-conceptual');
    expect(imported.document.processes[0].nodes.review.type).toBe('userTask');
    expect(imported.document.processes[0].sequenceFlows.Flow_Start.sourceRef).toBe('start');
    expect(imported.warnings).toHaveLength(1);
  });

  it('exports and reimports core control flow', () => {
    const exported = exportBpmnMermaid(createBpmnDocument());
    expect(exported).toContain('%% bpmn:process');
    expect(exported).toContain('type="exclusiveGateway"');
    const imported = importBpmnMermaid(exported);
    expect(imported.document.processes[0].nodes.Gateway_Approved.type).toBe('exclusiveGateway');
    expect(Object.keys(imported.document.processes[0].sequenceFlows)).toHaveLength(5);
  });

  it('requires a Mermaid flowchart header', () => {
    expect(() => importBpmnMermaid('start --> end')).toThrow(/header/);
  });

  it('imports lanes, participants, messages, and directive-only nodes and flows', () => {
    const mermaid = `flowchart LR
      buyer["Buyer"]:::participant
      seller["Seller"]:::participant
      buyer -.->|"Order"| seller
      %% bpmn:process id="Process_1" name="Order" executable="true"
      %% bpmn:node id="start" process="Process_1" type="startEvent" name="Start"
      %% bpmn:node id="finish" process="Process_1" type="endEvent" name="Finish"
      %% bpmn:flow id="Flow_1" process="Process_1" source="start" target="finish" condition="ok"
      %% bpmn:lane id="Lane_1" process="Process_1" name="Owner" nodes="start finish"
      %% bpmn:participant id="buyer" name="Buyer"
      %% bpmn:participant id="seller" process="Process_1" name="Seller"
      %% bpmn:message id="MessageFlow_1" source="buyer" target="seller" name="Order"`;
    const imported = importBpmnMermaid(mermaid);
    expect(imported.document.processes[0].sequenceFlows.Flow_1.conditionExpression).toBe('ok');
    expect(imported.document.processes[0].lanes.Lane_1.flowNodeRefs).toEqual(['start', 'finish']);
    expect(imported.document.collaborations[0].messageFlows.MessageFlow_1.name).toBe('Order');
  });

  it('exports collaboration and lane annotations', () => {
    const exported = exportBpmnMermaid(createRichBpmnDocument());
    expect(exported).toContain('%% bpmn:collaboration');
    expect(exported).toContain('%% bpmn:participant');
    expect(exported).toContain('%% bpmn:message');
    expect(exported).toContain('%% bpmn:lane');
    expect(exported).toContain('-.->');
  });

  it('supports unannotated edge-only diagrams and duplicate flow ids', () => {
    const imported = importBpmnMermaid(
      'graph TD\n  alpha --> beta\n  alpha --> beta\n  %% bpmn:flow id="Flow_X" source="alpha" target="beta"\n  %% bpmn:flow id="Flow_X" source="alpha" target="beta"'
    );
    expect(Object.keys(imported.document.processes[0].nodes)).toEqual(['alpha', 'beta']);
    expect(Object.keys(imported.document.processes[0].sequenceFlows)).toEqual([
      'Flow_X',
      'Flow_X_2',
    ]);
  });

  it('rejects empty, oversized, node-less, and invalid directives', () => {
    expect(() => importBpmnMermaid(' ')).toThrow(/empty/);
    expect(() => importBpmnMermaid(`flowchart LR\n${'x'.repeat(5_000_001)}`)).toThrow(/5 MB/);
    expect(() => importBpmnMermaid('flowchart LR\n  classDef task fill:#fff')).toThrow(
      /No Mermaid nodes/
    );
    expect(() =>
      importBpmnMermaid('flowchart LR\n  a["A"]\n  %% bpmn:node id="a" type="unsupported"')
    ).toThrow(/Unsupported/);
    expect(() =>
      importBpmnMermaid('flowchart LR\n  a["A"]\n  %% bpmn:flow id="Flow_1" source="a"')
    ).toThrow(/requires source and target/);
  });

  it('rejects unknown process and cross-process sequence references', () => {
    expect(() =>
      importBpmnMermaid(
        'flowchart LR\n  a["A"]\n  %% bpmn:process id="Process_1"\n  %% bpmn:node id="a" process="Missing" type="task"'
      )
    ).toThrow(/unknown process/);
    expect(() =>
      importBpmnMermaid(`flowchart LR
        a["A"]
        b["B"]
        a --> b
        %% bpmn:process id="Process_A"
        %% bpmn:process id="Process_B"
        %% bpmn:node id="a" process="Process_A" type="task"
        %% bpmn:node id="b" process="Process_B" type="task"`)
    ).toThrow(/must stay inside one BPMN process/);
  });
});
