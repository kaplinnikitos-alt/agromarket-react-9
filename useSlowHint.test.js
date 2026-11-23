import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { useSlowHint } from './useSlowHint';

// Тест хука: renderHook отрисовывает «невидимый» компонент и отдаёт result.current.
// Время подменяем (fake timers), чтобы не ждать 3 настоящие секунды.
describe('useSlowHint', () => {
  test('сначала false', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSlowHint(true, 3000));
    expect(result.current).toBe(false);
  });

  test('становится true, когда ожидание длится дольше порога', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSlowHint(true, 3000));

    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  test('если загрузка закончилась раньше порога, подсказка не появляется', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useSlowHint(active, 3000), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(1000); });
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(result.current).toBe(false);
  });

  test('после окончания загрузки подсказка пропадает', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useSlowHint(active, 3000), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(true);

    rerender({ active: false });

    expect(result.current).toBe(false);
  });

  test('без активной загрузки таймер не запускается', () => {
    vi.useFakeTimers();
    renderHook(() => useSlowHint(false, 3000));
    expect(vi.getTimerCount()).toBe(0);
  });
});
