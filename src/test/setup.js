import '@testing-library/jest-dom/vitest'; // матчеры toBeInTheDocument, toBeDisabled...
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();             // убираем отрисованное после каждого теста
  vi.restoreAllMocks();  // и все подмены (spyOn)
  vi.unstubAllGlobals(); // и подмены глобальных объектов (location)
  vi.useRealTimers();    // и «поддельные» таймеры
  localStorage.clear();  // токен из прошлого теста не должен мешать
});
