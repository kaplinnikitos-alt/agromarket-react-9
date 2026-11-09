import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';

test('Testing Library работает', () => {
  render(<h1>АгроМаркет</h1>);
  expect(screen.getByRole('heading', { name: 'АгроМаркет' })).toBeInTheDocument();
});
