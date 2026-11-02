/** Call `onResize` with the CSS size of `element` now and whenever it changes. */
export function observeSize(element: HTMLElement, onResize: (width: number, height: number) => void): void {
  const notify = (): void => {
    const rect = element.getBoundingClientRect();
    onResize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
  };
  new ResizeObserver(notify).observe(element);
  notify();
}
