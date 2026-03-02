import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, CONSTRAINTS_PROMPT, generateUserPrompt, buildFullPrompt } from './prompts';

describe('prompts', () => {
  // -------------------------------------------------------
  // SYSTEM_PROMPT
  // -------------------------------------------------------
  describe('SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof SYSTEM_PROMPT).toBe('string');
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain expected keywords about the assistant role', () => {
      expect(SYSTEM_PROMPT).toContain('FlowOps');
      expect(SYSTEM_PROMPT).toContain('アシスタント');
      expect(SYSTEM_PROMPT).toContain('JSON Patch');
      expect(SYSTEM_PROMPT).toContain('YAML');
    });
  });

  // -------------------------------------------------------
  // CONSTRAINTS_PROMPT
  // -------------------------------------------------------
  describe('CONSTRAINTS_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof CONSTRAINTS_PROMPT).toBe('string');
      expect(CONSTRAINTS_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain constraint keywords', () => {
      expect(CONSTRAINTS_PROMPT).toContain('禁止事項');
      expect(CONSTRAINTS_PROMPT).toContain('spec/flows/');
      expect(CONSTRAINTS_PROMPT).toContain('spec/dict/');
      expect(CONSTRAINTS_PROMPT).toContain('role');
      expect(CONSTRAINTS_PROMPT).toContain('system');
    });
  });

  // -------------------------------------------------------
  // generateUserPrompt
  // -------------------------------------------------------
  describe('generateUserPrompt', () => {
    const baseParams = {
      issueTitle: 'テストタイトル',
      issueDescription: 'テスト説明文',
      flowYaml: 'id: flow_1\ntitle: テストフロー',
    };

    it('should include issue title and description', () => {
      const result = generateUserPrompt(baseParams);
      expect(result).toContain('タイトル: テストタイトル');
      expect(result).toContain('テスト説明文');
    });

    it('should include the YAML flow definition in a code block', () => {
      const result = generateUserPrompt(baseParams);
      expect(result).toContain('```yaml');
      expect(result).toContain('id: flow_1');
      expect(result).toContain('```');
    });

    it('should include the closing instruction', () => {
      const result = generateUserPrompt(baseParams);
      expect(result).toContain('修正提案をJSON形式で出力してください');
    });

    it('should not include roles/systems sections when omitted', () => {
      const result = generateUserPrompt(baseParams);
      expect(result).not.toContain('使用可能なRole');
      expect(result).not.toContain('使用可能なSystem');
    });

    it('should include roles section when roles are provided', () => {
      const result = generateUserPrompt({
        ...baseParams,
        roles: ['manager', 'engineer'],
      });
      expect(result).toContain('## 使用可能なRole');
      expect(result).toContain('- manager');
      expect(result).toContain('- engineer');
    });

    it('should include systems section when systems are provided', () => {
      const result = generateUserPrompt({
        ...baseParams,
        systems: ['Slack', 'JIRA'],
      });
      expect(result).toContain('## 使用可能なSystem');
      expect(result).toContain('- Slack');
      expect(result).toContain('- JIRA');
    });

    it('should not include roles section when roles array is empty', () => {
      const result = generateUserPrompt({ ...baseParams, roles: [] });
      expect(result).not.toContain('使用可能なRole');
    });
  });

  // -------------------------------------------------------
  // buildFullPrompt
  // -------------------------------------------------------
  describe('buildFullPrompt', () => {
    const baseParams = {
      issueTitle: 'タイトル',
      issueDescription: '説明',
      flowYaml: 'id: flow_1',
    };

    it('should return an object with system and user keys', () => {
      const result = buildFullPrompt(baseParams);
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
    });

    it('should combine SYSTEM_PROMPT and CONSTRAINTS_PROMPT in system field', () => {
      const result = buildFullPrompt(baseParams);
      expect(result.system).toBe(SYSTEM_PROMPT + CONSTRAINTS_PROMPT);
      expect(result.system).toContain('FlowOps');
      expect(result.system).toContain('禁止事項');
    });

    it('should use generateUserPrompt for the user field', () => {
      const result = buildFullPrompt(baseParams);
      expect(result.user).toContain('タイトル: タイトル');
      expect(result.user).toContain('id: flow_1');
      expect(result.user).toContain('修正提案をJSON形式で出力してください');
    });
  });
});
