import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLog } from '@/core/audit/logger';
import { compileWorkflow, humanLoopManager, workflowEngine } from '@/core/orchestrator';
import { parseFlowYaml } from '@/core/parser';
import { getFlowYaml } from '@/lib/flow-service';
import { prisma } from '@/lib/prisma';

import { POST } from './route';

vi.mock('@/lib/prisma', () => ({
  prisma: { workflowExecution: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/core/audit/logger', () => ({
  auditLog: { logWorkflowAction: vi.fn() },
}));

describe('design-change workflow approval', () => {
  const executionId = 'test-design-change';
  const submitDecision = vi.spyOn(humanLoopManager, 'submitDecision');
  const updateExecution = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    workflowEngine.setRepository({
      createExecution: vi.fn(),
      updateExecution,
      getExecution: vi.fn(),
      createTaskExecution: vi.fn(),
      createApprovalRequest: vi.fn().mockResolvedValue('test-approval'),
      createGateEvaluation: vi.fn(),
    });
  });

  async function startChange(validationStatus: string) {
    const yaml = await getFlowYaml('design-change');
    const { flow } = parseFlowYaml(yaml!, 'design-change.yaml');
    const compiled = await compileWorkflow(flow!);
    const state = await workflowEngine.startExecution(compiled, 'test-trace', 'author', {
      evidence_complete: true,
      is_safety_part: false,
      has_process_change: false,
      has_supplier_change: false,
      validation_status: validationStatus,
    });
    expect(state).toMatchObject({ status: 'paused-human-review', currentNodeId: 'approval' });
    expect(state.stateData).not.toHaveProperty('change_approved');

    vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue({
      ...state,
      id: executionId,
      stateData: JSON.stringify(state.stateData),
      approvalRequests: [{ id: 'test-approval' }],
    } as never);
    submitDecision.mockResolvedValue({} as never);
  }

  function decide(actor: string, approved: boolean) {
    return POST(
      new Request('http://localhost/api/workflows/test-design-change/approve', {
        method: 'POST',
        headers: { 'x-actor-id': actor, 'content-type': 'application/json' },
        body: JSON.stringify({ approved, reason: 'Synthetic review' }),
      }),
      { params: Promise.resolve({ id: executionId }) }
    );
  }

  it('resumes an approved change and reaches release only with passing verification', async () => {
    await startChange('passed');
    const response = await decide('design-leader', true);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { decision: 'approved', workflowStatus: 'completed', currentNodeId: 'end_released' },
    });
    expect(submitDecision).toHaveBeenCalledWith(
      'test-approval',
      { approved: true, reason: 'Synthetic review', decidedBy: 'design-leader' },
      'test-trace'
    );
    expect(updateExecution).toHaveBeenCalledWith(
      executionId,
      expect.objectContaining({
        stateData: expect.objectContaining({
          change_approved: true,
          update_drawings_bom_completed: true,
          trial_validation_completed: true,
          release_change_completed: true,
        }),
      })
    );
  });

  it('resubmits after failed verification without releasing drawings', async () => {
    await startChange('failed');
    const response = await decide('design-leader', true);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { workflowStatus: 'paused-human-review', currentNodeId: 'approval' },
    });
    expect(updateExecution).not.toHaveBeenCalledWith(
      executionId,
      expect.objectContaining({
        stateData: expect.objectContaining({ release_change_completed: true }),
      })
    );
  });

  it('records rejection and never resumes, and blocks initiator self-approval', async () => {
    await startChange('passed');
    updateExecution.mockClear();

    expect((await decide('author', true)).status).toBe(403);
    expect(submitDecision).not.toHaveBeenCalled();

    const response = await decide('design-leader', false);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { decision: 'rejected', workflowStatus: 'failed' },
    });
    expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
      where: { id: executionId },
      data: { status: 'failed', stateData: expect.stringContaining('Synthetic review') },
    });
    expect(updateExecution).not.toHaveBeenCalled();
    expect(auditLog.logWorkflowAction).toHaveBeenCalled();
  });
});
