/**
 * FlowOps - Policy Loader
 *
 * sensitivity-levels.yaml / access-policies.yaml からポリシー定義をロードする
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

export interface SensitivityLevelConfig {
  id: string;
  name: string;
  description?: string;
  aiUsageAllowed: boolean;
  abstractionRequired: boolean;
  exportAllowed: boolean;
  auditLevel: string;
}

export interface AccessPolicyConfig {
  id: string;
  name: string;
  description?: string;
  sensitivityLevel: string;
  carrierConstraint: string;
  aiUsageAllowed: boolean;
  abstractionRequired: boolean;
  exportPolicy: string;
  auditLevel: string;
  reverseReferable: boolean;
}

export function loadSensitivityLevels(specDir?: string): Record<string, SensitivityLevelConfig> {
  const dir = specDir || path.join(process.cwd(), 'spec', 'dictionary');
  const filePath = path.join(dir, 'sensitivity-levels.yaml');
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.parse(content) as Record<string, SensitivityLevelConfig>;
}

export function loadAccessPolicies(specDir?: string): Record<string, AccessPolicyConfig> {
  const dir = specDir || path.join(process.cwd(), 'spec', 'dictionary');
  const filePath = path.join(dir, 'access-policies.yaml');
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.parse(content) as Record<string, AccessPolicyConfig>;
}
