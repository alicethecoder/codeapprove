export class CountdownLatch {
  private completed: number = 0;
  private done: Promise<void>;
  private res!: () => void;

  constructor(private total: number) {
    this.done = new Promise((res) => {
      this.res = res;
    });
  }

  decrement(i: number = 1) {
    this.completed += i;
    if (this.completed >= this.total) {
      this.res();
    }
  }

  wait(): Promise<void> {
    return this.done;
  }
}
