import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import ProductCard from './ProductCard';

const product = {
  id: 2,
  name: 'Мёд натуральный, 1 л',
  price: 4500,
  image: 'https://placehold.co/300x200?text=Med',
};

describe('ProductCard', () => {
  test('показывает название, цену и картинку с alt', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Мёд натуральный, 1 л' })).toBeInTheDocument();
    expect(screen.getByText('4500 тг')).toBeInTheDocument();
    // alt нужен экранным дикторам; заодно это способ найти картинку «как человек»
    expect(screen.getByRole('img', { name: product.name })).toHaveAttribute('src', product.image);
  });

  test('кнопка «В корзину» вызывает onAdd с товаром', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn(); // «шпион»: запоминает, как его вызвали
    render(<ProductCard product={product} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /в корзину/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  test('каждый клик — отдельный вызов onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ProductCard product={product} onAdd={onAdd} />);

    const button = screen.getByRole('button', { name: /в корзину/i });
    await user.click(button);
    await user.click(button);

    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  test('у «товара недели» есть бейдж', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} featured />);
    expect(screen.getByText('Товар недели')).toBeInTheDocument();
  });

  test('у обычного товара бейджа нет', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} />);
    // queryBy: элемента может не быть, вернётся null
    expect(screen.queryByText('Товар недели')).not.toBeInTheDocument();
  });

  test('карточку можно найти по data-testid (нужно для E2E)', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} />);
    expect(screen.getByTestId('product-card')).toBeInTheDocument();
  });
});
