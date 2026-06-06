import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the module
vi.mock('@/core/audit', () => ({
  auditLog: { setRepository: vi.fn() },
}));

vi.mock('@/lib/audit-repository', () => ({
  auditRepository: { save: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({
  validateEnv: vi.fn(),
}));

const fakeTaskExecutor = { execute: vi.fn() };
vi.mock('@/core/orchestrator', () => ({
  workflowEngine: { setRepository: vi.fn(), setTaskExecutor: vi.fn() },
  humanLoopManager: { setRepository: vi.fn() },
  createTaskExecutor: vi.fn(() => fakeTaskExecutor),
}));

vi.mock('@/lib/workflow-repository', () => ({
  workflowRepository: { kind: 'workflow' },
  approvalRepository: { kind: 'approval' },
}));

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call validateEnv on module load', async () => {
    vi.resetModules();
    await import('@/lib/bootstrap');
    const { validateEnv } = await import('@/lib/env');
    expect(validateEnv).toHaveBeenCalled();
  });

  it('should call auditLog.setRepository with auditRepository on module load', async () => {
    vi.resetModules();
    await import('@/lib/bootstrap');
    const { auditLog } = await import('@/core/audit');
    const { auditRepository } = await import('@/lib/audit-repository');
    expect(auditLog.setRepository).toHaveBeenCalledWith(auditRepository);
  });

  it('should wire the workflow engine repository and task executor on module load', async () => {
    vi.resetModules();
    await import('@/lib/bootstrap');
    const { workflowEngine, createTaskExecutor } = await import('@/core/orchestrator');
    const { workflowRepository } = await import('@/lib/workflow-repository');
    expect(workflowEngine.setRepository).toHaveBeenCalledWith(workflowRepository);
    expect(createTaskExecutor).toHaveBeenCalled();
    expect(workflowEngine.setTaskExecutor).toHaveBeenCalledWith(fakeTaskExecutor);
  });

  it('should wire the human loop manager repository on module load', async () => {
    vi.resetModules();
    await import('@/lib/bootstrap');
    const { humanLoopManager } = await import('@/core/orchestrator');
    const { approvalRepository } = await import('@/lib/workflow-repository');
    expect(humanLoopManager.setRepository).toHaveBeenCalledWith(approvalRepository);
  });

  it('should log initialization message when initializeApp is called', async () => {
    vi.resetModules();
    const { initializeApp } = await import('@/lib/bootstrap');
    const { logger } = await import('@/lib/logger');
    initializeApp();
    expect(logger.info).toHaveBeenCalledWith('FlowOps application initialized');
  });
});
