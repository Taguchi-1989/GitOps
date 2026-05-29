import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT,
  CONSTRAINTS_PROMPT,
  generateUserPrompt,
  buildFullPrompt,
  buildInterviewPrompt,
  buildMetricSuggestionPrompt,
} from './prompts';

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

    it('should not include the PDCA background section when no plan context is given', () => {
      const result = generateUserPrompt(baseParams);
      expect(result).not.toContain('PDCA Plan');
    });

    it('should include only the PDCA fields that are provided', () => {
      const result = generateUserPrompt({
        ...baseParams,
        expectedState: '在庫がリアルタイムで分かる',
        successMetric: '欠品率',
      });
      expect(result).toContain('改善の背景（PDCA Plan フェーズの情報）');
      expect(result).toContain('期待する状態: 在庫がリアルタイムで分かる');
      expect(result).toContain('効果を測る指標: 欠品率');
      // hypothesisCause は未指定なので含まれない
      expect(result).not.toContain('原因の仮説:');
    });

    it('should include the hypothesis cause when provided', () => {
      const result = generateUserPrompt({
        ...baseParams,
        hypothesisCause: '手作業の転記ミス',
      });
      expect(result).toContain('原因の仮説: 手作業の転記ミス');
    });
  });

  // -------------------------------------------------------
  // buildInterviewPrompt
  // -------------------------------------------------------
  describe('buildInterviewPrompt', () => {
    const baseParams = {
      issueTitle: '出荷が遅れる',
      issueDescription: '梱包工程で時間がかかる',
    };

    it('should return system and user prompts', () => {
      const result = buildInterviewPrompt(baseParams);
      expect(result.system).toContain('現場改善の専門家');
      expect(result.system).toContain('questions');
      expect(result.user).toContain('出荷が遅れる');
      expect(result.user).toContain('梱包工程で時間がかかる');
    });

    it('should include the current situation section when provided', () => {
      const result = buildInterviewPrompt({
        ...baseParams,
        currentSituation: '1日に3件は遅延している',
      });
      expect(result.user).toContain('## 現状の困りごと');
      expect(result.user).toContain('1日に3件は遅延している');
    });

    it('should omit the current situation section when not provided', () => {
      const result = buildInterviewPrompt(baseParams);
      expect(result.user).not.toContain('## 現状の困りごと');
    });
  });

  // -------------------------------------------------------
  // buildMetricSuggestionPrompt
  // -------------------------------------------------------
  describe('buildMetricSuggestionPrompt', () => {
    const baseParams = {
      issueTitle: '問い合わせ対応が遅い',
      issueDescription: '一次回答に時間がかかる',
    };

    it('should return system and user prompts', () => {
      const result = buildMetricSuggestionPrompt(baseParams);
      expect(result.system).toContain('効果測定の専門家');
      expect(result.system).toContain('metrics');
      expect(result.user).toContain('問い合わせ対応が遅い');
      expect(result.user).toContain('一次回答に時間がかかる');
    });

    it('should include the expected state section when provided', () => {
      const result = buildMetricSuggestionPrompt({
        ...baseParams,
        expectedState: '一次回答を1時間以内にする',
      });
      expect(result.user).toContain('## 期待する状態');
      expect(result.user).toContain('一次回答を1時間以内にする');
    });

    it('should omit the expected state section when not provided', () => {
      const result = buildMetricSuggestionPrompt(baseParams);
      expect(result.user).not.toContain('## 期待する状態');
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
