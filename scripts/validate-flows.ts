/** Validate every SSOT flow against schemas, dictionaries, and structural rules. */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { DictionarySchema, parseFlowYaml, validateFlowIntegrity } from '@/core/parser';
import { analyzeFlowStructure } from '@/core/flow-builder/structural-validator';
import { isSupportedConditionExpression } from '@/core/orchestrator/condition-expression';

const root = process.cwd();
const flowsDir = path.join(root, 'spec', 'flows');
const dictionary = DictionarySchema.parse({
  roles: YAML.parse(fs.readFileSync(path.join(root, 'spec', 'dictionary', 'roles.yaml'), 'utf8')),
  systems: YAML.parse(
    fs.readFileSync(path.join(root, 'spec', 'dictionary', 'systems.yaml'), 'utf8')
  ),
});

let errorCount = 0;
let warningCount = 0;
const files = fs
  .readdirSync(flowsDir)
  .filter(file => file.endsWith('.yaml'))
  .sort();

for (const file of files) {
  const content = fs.readFileSync(path.join(flowsDir, file), 'utf8');
  const parsed = parseFlowYaml(content, file);
  if (!parsed.success || !parsed.flow) {
    for (const error of parsed.errors) {
      console.error(`[flow:error] ${file}: ${error.code} ${error.message}`);
      errorCount++;
    }
    continue;
  }

  const integrity = validateFlowIntegrity(parsed.flow, dictionary);
  for (const error of integrity.errors) {
    console.error(`[flow:error] ${file}: ${error.code} ${error.message}`);
    errorCount++;
  }

  for (const edge of Object.values(parsed.flow.edges)) {
    if (edge.condition && !isSupportedConditionExpression(edge.condition)) {
      console.error(
        `[flow:error] ${file}: CONDITION_UNSUPPORTED Edge "${edge.id}" uses unsupported condition "${edge.condition}"`
      );
      errorCount++;
    }
  }

  const structural = analyzeFlowStructure(parsed.flow, dictionary);
  for (const finding of structural.findings) {
    const line = `[flow:${finding.severity}] ${file}: ${finding.code} ${finding.message}`;
    if (finding.severity === 'error') {
      console.error(line);
      errorCount++;
    } else if (finding.severity === 'warning') {
      console.warn(line);
      warningCount++;
    }
  }
}

console.log(`[flow:summary] files=${files.length} errors=${errorCount} warnings=${warningCount}`);
if (errorCount > 0) process.exit(1);
