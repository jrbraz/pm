import { renderHook, act } from "@testing-library/react";
import { useDebouncedCallback } from "@/lib/useDebounce";

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delays execution by the specified time", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => result.current());
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(500));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("only fires the last call within the debounce window", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => result.current());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current());

    // Only 300ms from last call should trigger
    act(() => vi.advanceTimersByTime(300));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not fire if not enough time has passed", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => result.current());
    act(() => vi.advanceTimersByTime(200));
    expect(callback).not.toHaveBeenCalled();
  });
});
