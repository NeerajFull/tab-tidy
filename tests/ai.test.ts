import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { AiError, buildPrompt, describeAiError } from '../lib/ai';

describe('buildPrompt', () => {
  it('sends group names, then index, group, site path and trimmed title', () => {
    const prompt = buildPrompt([
      { url: 'https://github.com/o/r/pull/1?token=secret#x', title: '  FC-1610:\n Rate limit  ', group: 'GitHub' },
      { url: 'https://grafana.anywhere.co/d/aeik/bug-slo?var-component=FormCreator', title: 'y'.repeat(200) },
    ]);
    expect(prompt).toBe(
      [
        'Groups:',
        '- GitHub',
        '',
        'Tabs:',
        '0 | GitHub | github.com/o/r/pull/1 | FC-1610: Rate limit',
        `1 | - | grafana.anywhere.co/d/aeik/bug-slo | ${'y'.repeat(80)}`,
      ].join('\n'),
    );
    expect(prompt).not.toContain('secret');
    expect(prompt).not.toContain('FormCreator');
  });
});

describe('describeAiError', () => {
  it('passes through AI errors', () => {
    expect(describeAiError(new AiError('Model stopped early (max_tokens)'))).toBe('Model stopped early (max_tokens)');
  });

  it('describes an answer that could not be read', () => {
    expect(describeAiError(new Anthropic.AnthropicError('Failed to parse structured output'))).toBe(
      'Could not read the answer',
    );
  });

  it('falls back for unknown errors', () => {
    expect(describeAiError(new Error('boom'))).toBe('AI check failed');
  });
});
