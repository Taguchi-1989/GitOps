const NUMERIC_COMPARISON = /^([\w.-]+)\s*(>=|<=|>|<)\s*(-?(?:\d+\.?\d*|\.\d+))$/;
const EQUALITY = /^([\w.-]+)\s*==\s*['"]?(.+?)['"]?$/;
const INEQUALITY = /^([\w.-]+)\s*!=\s*['"]?(.+?)['"]?$/;
const TRUTHY_KEY = /^[\w.-]+$/;

export function isSupportedConditionExpression(condition: string): boolean {
  return (
    NUMERIC_COMPARISON.test(condition) ||
    EQUALITY.test(condition) ||
    INEQUALITY.test(condition) ||
    TRUTHY_KEY.test(condition)
  );
}

export function evaluateConditionExpression(
  condition: string,
  stateData: Record<string, unknown>
): boolean {
  const numericMatch = condition.match(NUMERIC_COMPARISON);
  if (numericMatch) {
    const [, key, operator, rawExpected] = numericMatch;
    const actual = Number(stateData[key]);
    const expected = Number(rawExpected);
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    if (operator === '>') return actual > expected;
    if (operator === '>=') return actual >= expected;
    if (operator === '<') return actual < expected;
    return actual <= expected;
  }

  const equalityMatch = condition.match(EQUALITY);
  if (equalityMatch) {
    const [, key, value] = equalityMatch;
    return String(stateData[key]) === value;
  }

  const inequalityMatch = condition.match(INEQUALITY);
  if (inequalityMatch) {
    const [, key, value] = inequalityMatch;
    return String(stateData[key]) !== value;
  }

  if (TRUTHY_KEY.test(condition)) return Boolean(stateData[condition]);
  return false;
}
