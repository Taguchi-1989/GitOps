/**
 * FlowOps - Task Loader Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadTask, listTasks, loadAllTasks, TaskLoadError } from './task-loader';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

const validTaskYaml = `
id: classify-inquiry
version: "1.0.0"
type: llm-inference

llmConfig:
  systemPrompt: "You are a classifier"
  userPromptTemplate: "{{text}}"
  temperature: 0.1
  maxTokens: 256

inputSchema:
  type: object

outputSchema:
  type: object

requiresHumanApproval: false
maxRetries: 2
timeoutMs: 15000

metadata:
  author: "test"
  description: "Test task"
`;

describe('loadTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and validate a valid task YAML', async () => {
    mockReadFile.mockResolvedValue(validTaskYaml);

    const task = await loadTask('classify-inquiry');

    expect(task.id).toBe('classify-inquiry');
    expect(task.version).toBe('1.0.0');
    expect(task.type).toBe('llm-inference');
    expect(task.llmConfig).toBeDefined();
    expect(task.metadata.author).toBe('test');
  });

  it('should throw FILE_NOT_FOUND when file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(loadTask('nonexistent')).rejects.toThrow(TaskLoadError);
    try {
      await loadTask('nonexistent');
    } catch (e) {
      expect((e as TaskLoadError).code).toBe('FILE_NOT_FOUND');
    }
  });

  it('should throw PARSE_ERROR for invalid YAML', async () => {
    mockReadFile.mockResolvedValue('{{{{invalid yaml');

    await expect(loadTask('bad')).rejects.toThrow(TaskLoadError);
    try {
      await loadTask('bad');
    } catch (e) {
      expect((e as TaskLoadError).code).toBe('PARSE_ERROR');
    }
  });

  it('should throw VALIDATION_ERROR for schema violations', async () => {
    mockReadFile.mockResolvedValue(`
id: test
version: "not-semver"
type: llm-inference
inputSchema:
  type: object
outputSchema:
  type: object
metadata:
  author: "test"
  description: "test"
`);

    await expect(loadTask('test')).rejects.toThrow(TaskLoadError);
    try {
      await loadTask('test');
    } catch (e) {
      expect((e as TaskLoadError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('should throw VALIDATION_ERROR when task ID mismatches filename', async () => {
    mockReadFile.mockResolvedValue(validTaskYaml);

    // Filename is 'wrong-name' but task ID is 'classify-inquiry'
    await expect(loadTask('wrong-name')).rejects.toThrow(TaskLoadError);
    try {
      await loadTask('wrong-name');
    } catch (e) {
      expect((e as TaskLoadError).code).toBe('VALIDATION_ERROR');
      expect((e as TaskLoadError).message).toContain('ID mismatch');
    }
  });
});

describe('listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list task IDs from directory', async () => {
    mockReaddir.mockResolvedValue(['task-a.yaml', 'task-b.yml', 'readme.md'] as unknown as Awaited<
      ReturnType<typeof fs.readdir>
    >);

    const ids = await listTasks();

    expect(ids).toEqual(['task-a', 'task-b']);
  });

  it('should return empty array when directory does not exist', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));

    const ids = await listTasks();

    expect(ids).toEqual([]);
  });
});

describe('loadAllTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load all valid tasks and skip errors', async () => {
    mockReaddir.mockResolvedValue(['classify-inquiry.yaml', 'bad-task.yaml'] as unknown as Awaited<
      ReturnType<typeof fs.readdir>
    >);

    mockReadFile.mockImplementation(async path => {
      if (String(path).includes('classify-inquiry')) {
        return validTaskYaml;
      }
      throw new Error('ENOENT');
    });

    const tasks = await loadAllTasks();

    expect(tasks.size).toBe(1);
    expect(tasks.has('classify-inquiry')).toBe(true);
  });
});
