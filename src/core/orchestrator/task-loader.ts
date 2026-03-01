/**
 * FlowOps - Task Loader
 *
 * spec/tasks/ からマイクロタスク定義YAMLを読込・検証
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { MicroTaskDefinitionSchema, MicroTaskDefinition } from './schemas/micro-task';

const TASKS_DIR = process.env.TASKS_DIR || path.join(process.cwd(), 'spec', 'tasks');

export class TaskLoadError extends Error {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR';

  constructor(code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'TaskLoadError';
    this.code = code;
  }
}

/**
 * 単一タスク定義を読込・検証
 */
export async function loadTask(taskId: string): Promise<MicroTaskDefinition> {
  const filePath = path.join(TASKS_DIR, `${taskId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new TaskLoadError('FILE_NOT_FOUND', `Task file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new TaskLoadError(
      'PARSE_ERROR',
      `Failed to parse task YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = MicroTaskDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    throw new TaskLoadError(
      'VALIDATION_ERROR',
      `Task validation failed for '${taskId}': ${result.error.message}`
    );
  }

  // タスクIDとファイル名の一致を検証
  if (result.data.id !== taskId) {
    throw new TaskLoadError(
      'VALIDATION_ERROR',
      `Task ID mismatch: file='${taskId}', content.id='${result.data.id}'`
    );
  }

  return result.data;
}

/**
 * 全タスク定義を一覧取得
 */
export async function listTasks(): Promise<string[]> {
  try {
    const files = await fs.readdir(TASKS_DIR);
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.basename(f, path.extname(f)));
  } catch {
    return [];
  }
}

/**
 * 全タスクを読込・検証して返す
 */
export async function loadAllTasks(): Promise<Map<string, MicroTaskDefinition>> {
  const taskIds = await listTasks();
  const tasks = new Map<string, MicroTaskDefinition>();

  for (const taskId of taskIds) {
    try {
      const task = await loadTask(taskId);
      tasks.set(taskId, task);
    } catch {
      // 個別のロードエラーはスキップ（ログ出力は呼出元で行う）
    }
  }

  return tasks;
}
