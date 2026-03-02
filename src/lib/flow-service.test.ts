import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Flow } from '@/core/parser';

// --- Mocks ---

vi.mock('fs/promises');
vi.mock('@/core/parser');
vi.mock('yaml');
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/lib/api-utils', () => ({
  sanitizeFlowId: vi.fn((id: string) => {
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('.')) {
      return null;
    }
    return id;
  }),
}));

import fs from 'fs/promises';
import yaml from 'yaml';
import { parseFlowYaml, flowToMermaid, getFlowSummary } from '@/core/parser';
import { listFlows, getFlow, getFlowYaml, saveFlowYaml, getDictionary } from './flow-service';

const mockedFs = vi.mocked(fs);
const mockedParseFlowYaml = vi.mocked(parseFlowYaml);
const mockedFlowToMermaid = vi.mocked(flowToMermaid);
const mockedGetFlowSummary = vi.mocked(getFlowSummary);
const mockedYaml = vi.mocked(yaml);

// --- Helpers ---

function makeFakeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'order-process',
    title: 'Order Process',
    layer: 'L1',
    updatedAt: '2025-01-01',
    nodes: [
      { id: 'n1', label: 'Start', type: 'actor' },
      { id: 'n2', label: 'End', type: 'system' },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'go' }],
    ...overrides,
  } as Flow;
}

function makeEnoentError(): NodeJS.ErrnoException {
  const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// listFlows
// ============================================================
describe('listFlows', () => {
  it('lists yaml files from directory and returns summaries', async () => {
    const fakeFlow = makeFakeFlow();

    mockedFs.readdir.mockResolvedValue(['order-process.yaml', 'deploy.yml'] as any);
    mockedFs.readFile.mockResolvedValue('yaml-content');
    mockedParseFlowYaml.mockReturnValue({
      success: true,
      flow: fakeFlow,
      errors: [],
    } as any);
    mockedGetFlowSummary.mockReturnValue({ nodeCount: 2, edgeCount: 1 } as any);

    const result = await listFlows();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'order-process',
      title: 'Order Process',
      layer: 'L1',
      nodeCount: 2,
      edgeCount: 1,
      updatedAt: '2025-01-01',
    });
    expect(mockedFs.readdir).toHaveBeenCalledTimes(1);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
  });

  it('filters out non-yaml files', async () => {
    const fakeFlow = makeFakeFlow();

    mockedFs.readdir.mockResolvedValue([
      'order-process.yaml',
      'readme.md',
      'config.json',
      'deploy.yml',
      'notes.txt',
    ] as any);
    mockedFs.readFile.mockResolvedValue('yaml-content');
    mockedParseFlowYaml.mockReturnValue({
      success: true,
      flow: fakeFlow,
      errors: [],
    } as any);
    mockedGetFlowSummary.mockReturnValue({ nodeCount: 2, edgeCount: 1 } as any);

    const result = await listFlows();

    // Only .yaml and .yml files should be processed
    expect(result).toHaveLength(2);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
  });

  it('handles parse failures gracefully by skipping bad files', async () => {
    const fakeFlow = makeFakeFlow();

    mockedFs.readdir.mockResolvedValue(['good.yaml', 'bad.yaml'] as any);
    mockedFs.readFile.mockResolvedValue('yaml-content');
    mockedParseFlowYaml
      .mockReturnValueOnce({ success: true, flow: fakeFlow, errors: [] } as any)
      .mockReturnValueOnce({ success: false, flow: null, errors: ['parse error'] } as any);
    mockedGetFlowSummary.mockReturnValue({ nodeCount: 2, edgeCount: 1 } as any);

    const result = await listFlows();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-process');
  });

  it('skips files that throw during readFile', async () => {
    const fakeFlow = makeFakeFlow();

    mockedFs.readdir.mockResolvedValue(['good.yaml', 'corrupt.yaml'] as any);
    mockedFs.readFile
      .mockResolvedValueOnce('yaml-content')
      .mockRejectedValueOnce(new Error('read error'));
    mockedParseFlowYaml.mockReturnValue({
      success: true,
      flow: fakeFlow,
      errors: [],
    } as any);
    mockedGetFlowSummary.mockReturnValue({ nodeCount: 2, edgeCount: 1 } as any);

    const result = await listFlows();

    expect(result).toHaveLength(1);
  });

  it('returns empty array when directory does not exist (ENOENT)', async () => {
    mockedFs.readdir.mockRejectedValue(makeEnoentError());

    const result = await listFlows();

    expect(result).toEqual([]);
  });

  it('throws on non-ENOENT errors from readdir', async () => {
    const permError = new Error('EACCES: permission denied');
    mockedFs.readdir.mockRejectedValue(permError);

    await expect(listFlows()).rejects.toThrow('EACCES: permission denied');
  });
});

// ============================================================
// getFlow
// ============================================================
describe('getFlow', () => {
  it('returns flow with mermaid for a valid ID', async () => {
    const fakeFlow = makeFakeFlow();

    mockedFs.readFile.mockResolvedValue('yaml-content');
    mockedParseFlowYaml.mockReturnValue({
      success: true,
      flow: fakeFlow,
      errors: [],
    } as any);
    mockedFlowToMermaid.mockReturnValue('graph TD\n  n1-->n2');

    const result = await getFlow('order-process');

    expect(result).not.toBeNull();
    expect(result!.flow).toEqual(fakeFlow);
    expect(result!.mermaid).toBe('graph TD\n  n1-->n2');
    expect(result!.filePath).toContain('order-process.yaml');
    expect(mockedFlowToMermaid).toHaveBeenCalledWith(fakeFlow, {
      direction: 'TD',
      includeStyles: true,
      includeClickHandlers: true,
    });
  });

  it('returns null for invalid flow ID (path traversal)', async () => {
    const result = await getFlow('../etc/passwd');

    expect(result).toBeNull();
    expect(mockedFs.readFile).not.toHaveBeenCalled();
  });

  it('returns null when file does not exist', async () => {
    mockedFs.readFile.mockRejectedValue(makeEnoentError());

    const result = await getFlow('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null when parsing fails', async () => {
    mockedFs.readFile.mockResolvedValue('invalid yaml');
    mockedParseFlowYaml.mockReturnValue({
      success: false,
      flow: null,
      errors: ['validation error'],
    } as any);

    const result = await getFlow('bad-flow');

    expect(result).toBeNull();
    expect(mockedFlowToMermaid).not.toHaveBeenCalled();
  });
});

// ============================================================
// getFlowYaml
// ============================================================
describe('getFlowYaml', () => {
  it('returns YAML content for a valid ID', async () => {
    const yamlContent = 'id: order-process\ntitle: Order Process\n';
    mockedFs.readFile.mockResolvedValue(yamlContent);

    const result = await getFlowYaml('order-process');

    expect(result).toBe(yamlContent);
    expect(mockedFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('order-process.yaml'),
      'utf-8'
    );
  });

  it('returns null for an invalid flow ID', async () => {
    const result = await getFlowYaml('../secret');

    expect(result).toBeNull();
    expect(mockedFs.readFile).not.toHaveBeenCalled();
  });

  it('returns null when file does not exist', async () => {
    mockedFs.readFile.mockRejectedValue(makeEnoentError());

    const result = await getFlowYaml('missing-flow');

    expect(result).toBeNull();
  });
});

// ============================================================
// saveFlowYaml
// ============================================================
describe('saveFlowYaml', () => {
  it('saves content to the correct path', async () => {
    mockedFs.writeFile.mockResolvedValue(undefined);

    await saveFlowYaml('order-process', 'id: order-process\n');

    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('order-process.yaml'),
      'id: order-process\n',
      'utf-8'
    );
  });

  it('throws on invalid flow ID', async () => {
    await expect(saveFlowYaml('../hack', 'content')).rejects.toThrow('Invalid flow ID');
  });

  it('throws on empty flow ID', async () => {
    await expect(saveFlowYaml('', 'content')).rejects.toThrow('Invalid flow ID');
  });
});

// ============================================================
// getDictionary
// ============================================================
describe('getDictionary', () => {
  it('returns roles and systems from YAML files', async () => {
    mockedFs.readFile
      .mockResolvedValueOnce('admin: Admin User\noperator: Operator')
      .mockResolvedValueOnce('crm: CRM System\nerp: ERP System');
    mockedYaml.parse
      .mockReturnValueOnce({ admin: 'Admin User', operator: 'Operator' })
      .mockReturnValueOnce({ crm: 'CRM System', erp: 'ERP System' });

    const result = await getDictionary();

    expect(result.roles).toEqual(['admin', 'operator']);
    expect(result.systems).toEqual(['crm', 'erp']);
  });

  it('returns empty arrays when files do not exist', async () => {
    mockedFs.readFile.mockRejectedValue(makeEnoentError());

    const result = await getDictionary();

    expect(result).toEqual({ roles: [], systems: [] });
  });

  it('returns empty roles when roles file fails but systems succeeds', async () => {
    mockedFs.readFile
      .mockRejectedValueOnce(new Error('read error'))
      .mockResolvedValueOnce('crm: CRM');
    mockedYaml.parse.mockReturnValue({ crm: 'CRM' });

    const result = await getDictionary();

    expect(result.roles).toEqual([]);
    expect(result.systems).toEqual(['crm']);
  });

  it('handles yaml.parse returning null gracefully', async () => {
    mockedFs.readFile.mockResolvedValue('');
    mockedYaml.parse.mockReturnValue(null);

    const result = await getDictionary();

    expect(result).toEqual({ roles: [], systems: [] });
  });
});
