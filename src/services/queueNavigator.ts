import type { RepeatMode } from '../state/player';

// Traversal never mutates the published queue or playlist. Shuffle has an
// unplayed bag and real listening history, including distinct duplicate keys.
export class QueueNavigator {
  private keys: readonly string[] = [];
  private current: string | null = null;
  private shuffled = false;
  private remaining: string[] = [];
  private history: string[] = [];
  private position = 0;
  constructor(private random = Math.random) {}

  sync(keys: readonly string[], current: string | null, shuffled: boolean) {
    if (
      keys === this.keys &&
      current === this.current &&
      shuffled === this.shuffled
    )
      return;
    this.keys = keys;
    this.current = current;
    this.shuffled = shuffled;
    this.remaining = keys.filter((key) => key !== current);
    this.history = current ? [current] : [];
    this.position = 0;
  }
  canNext(mode: RepeatMode) {
    if (!this.current || !this.keys.includes(this.current)) return false;
    return this.shuffled
      ? this.position < this.history.length - 1 ||
          this.remaining.length > 0 ||
          mode === 'all'
      : this.keys.indexOf(this.current) < this.keys.length - 1 ||
          mode === 'all';
  }
  canPrevious(mode: RepeatMode) {
    if (!this.current || !this.keys.includes(this.current)) return false;
    return this.shuffled
      ? this.position > 0
      : this.keys.indexOf(this.current) > 0 || mode === 'all';
  }
  next(mode: RepeatMode, ended = false): string | null {
    if (!this.current || !this.keys.includes(this.current)) return null;
    if (ended && mode === 'one') return this.current;
    if (!this.canNext(mode)) return null;
    if (!this.shuffled) {
      this.current =
        this.keys[(this.keys.indexOf(this.current) + 1) % this.keys.length];
      return this.current;
    }
    if (this.position < this.history.length - 1) {
      this.current = this.history[++this.position];
      return this.current;
    }
    if (!this.remaining.length)
      this.remaining = this.keys.filter((key) => key !== this.current);
    if (!this.remaining.length) return this.current; // one-item queue + repeat-all
    const index = Math.min(
      this.remaining.length - 1,
      Math.max(0, Math.floor(this.random() * this.remaining.length))
    );
    const [key] = this.remaining.splice(index, 1);
    this.history.push(key);
    if (this.history.length > 200) this.history.shift();
    this.position = this.history.length - 1;
    this.current = key;
    return key;
  }
  previous(mode: RepeatMode): string | null {
    if (!this.canPrevious(mode)) return null;
    this.current = this.shuffled
      ? this.history[--this.position]
      : this.keys[
          (this.keys.indexOf(this.current!) - 1 + this.keys.length) %
            this.keys.length
        ];
    return this.current;
  }
}
