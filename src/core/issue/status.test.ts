import { describe, it, expect } from 'vitest';
import { validateStatusTransition } from './status';

describe('validateStatusTransition', () => {
  it('allows merged -> closed-ineffective', () => {
    expect(validateStatusTransition('merged', 'closed-ineffective').allowed).toBe(true);
  });

  it.each(['new', 'triage', 'in-progress', 'proposed', 'rejected', 'merged-duplicate'] as const)(
    'rejects %s -> closed-ineffective',
    from => {
      const result = validateStatusTransition(from, 'closed-ineffective');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('closed-ineffective');
    }
  );

  it('does not restrict other transitions', () => {
    expect(validateStatusTransition('new', 'in-progress').allowed).toBe(true);
    expect(validateStatusTransition('proposed', 'rejected').allowed).toBe(true);
    expect(validateStatusTransition('merged', 'rejected').allowed).toBe(true);
  });
});
