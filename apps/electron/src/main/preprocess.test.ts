/**
 * Unit tests for transcript preprocess helpers.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { PreprocessConfig } from '@flwst/types';
import { applyPreprocess } from './preprocess';

describe('applyPreprocess', () => {
  it('returns unchanged content when disabled', () => {
    const config: PreprocessConfig = {
      enabled: false,
      ignoreList: ['remove-me'],
      dictionary: { foo: 'bar' },
    };

    const result = applyPreprocess('foo remove-me', config);

    assert.equal(result.content, 'foo remove-me');
    assert.deepEqual(result.applied, []);
  });

  it('applies dictionary replacements and ignore list', () => {
    const config: PreprocessConfig = {
      enabled: true,
      ignoreList: ['REMOVE', 'extra'],
      dictionary: { Flowsate: 'FlowState' },
    };

    const result = applyPreprocess('Flowsate REMOVE extra', config);

    assert.equal(result.content.trim(), 'FlowState');
    assert.deepEqual(result.applied, [
      'dictionary:Flowsate->FlowState',
      'ignore:REMOVE',
      'ignore:extra',
    ]);
  });
});
