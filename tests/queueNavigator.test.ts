import { describe, expect, it } from 'vitest';
import { QueueNavigator } from '../src/services/queueNavigator';

describe('queue traversal without playlist mutation', () => {
  it('stops at the end with repeat off and wraps with repeat queue', () => {
    const keys = ['a', 'b'];
    const nav = new QueueNavigator();
    nav.sync(keys, 'a', false);
    expect(nav.next('off', true)).toBe('b');
    expect(nav.next('off', true)).toBeNull();
    expect(nav.next('all', true)).toBe('a');
    expect(nav.previous('all')).toBe('b');
    expect(keys).toEqual(['a', 'b']);
  });
  it('repeats one only at natural end, while manual Next still advances', () => {
    const keys = ['a', 'b'];
    const nav = new QueueNavigator();
    nav.sync(keys, 'a', false);
    expect(nav.next('one', true)).toBe('a');
    expect(nav.next('one')).toBe('b');
    expect(nav.next('one', true)).toBe('b');
    expect(nav.canNext('one')).toBe(false);
  });
  it('shuffles without replacement and follows real Previous/Next history', () => {
    const keys = ['a', 'b', 'c'];
    const nav = new QueueNavigator(() => 0);
    nav.sync(keys, 'a', true);
    expect(nav.canPrevious('off')).toBe(false);
    expect(nav.next('off')).toBe('b');
    nav.sync(keys, 'b', true);
    expect(nav.previous('off')).toBe('a');
    nav.sync(keys, 'a', true);
    expect(nav.next('off')).toBe('b');
    expect(nav.next('off')).toBe('c');
    expect(nav.next('off')).toBeNull();
    expect(keys).toEqual(['a', 'b', 'c']);
  });
  it('starts a new shuffle round for repeat queue without an immediate duplicate', () => {
    const nav = new QueueNavigator(() => 0);
    nav.sync(['a', 'b', 'c'], 'a', true);
    expect(nav.next('all')).toBe('b');
    expect(nav.next('all')).toBe('c');
    expect(nav.next('all')).toBe('a');
    expect(nav.next('all')).toBe('b');
  });
  it('keeps distinct occurrences of the same resource and handles a one-song queue', () => {
    const nav = new QueueNavigator(() => 0);
    nav.sync(['same:0', 'same:1'], 'same:0', true);
    expect(nav.next('off')).toBe('same:1');
    expect(nav.next('off')).toBeNull();
    nav.sync(['only'], 'only', true);
    expect(nav.next('off')).toBeNull();
    expect(nav.next('all')).toBe('only');
    expect(nav.next('one', true)).toBe('only');
  });
  it('resets stale shuffle history for an externally selected song or replacement queue', () => {
    const nav = new QueueNavigator(() => 0);
    const keys = ['a', 'b', 'c'];
    nav.sync(keys, 'a', true);
    nav.next('off');
    nav.sync(keys, 'c', true);
    expect(nav.canPrevious('off')).toBe(false);
    expect(nav.next('off')).toBe('a');
    nav.sync(['x', 'y'], 'x', true);
    expect(nav.next('off')).toBe('y');
    nav.sync([], null, true);
    expect(nav.next('all')).toBeNull();
    expect(nav.previous('all')).toBeNull();
  });
});
