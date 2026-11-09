import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Header from './Header';
import Footer from './Footer';

describe('Header', () => {
  test('показывает навигацию по разделам страницы', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '#catalog');
    expect(screen.getByRole('link', { name: 'Доставка' })).toHaveAttribute('href', '#delivery');
    expect(screen.getByRole('link', { name: 'Контакты' })).toHaveAttribute('href', '#contact');
  });

  test('без props в корзине 0', () => {
    render(<Header />);
    expect(screen.getByText(/корзина: 0/i)).toBeInTheDocument();
  });

  test('показывает количество товаров в корзине', () => {
    render(<Header cartCount={3} />);
    expect(screen.getByText(/корзина: 3/i)).toBeInTheDocument();
  });
});

describe('Footer', () => {
  test('содержит телефон и почту ссылками', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: '+7 700 123 45 67' })).toHaveAttribute('href', 'tel:+77001234567');
    expect(screen.getByRole('link', { name: 'info@agromarket.kz' })).toHaveAttribute('href', 'mailto:info@agromarket.kz');
  });
});
