export function freezeArray<T>(arr: T[]): T[] {
  return arr.map((t) => Object.freeze(t));
}
