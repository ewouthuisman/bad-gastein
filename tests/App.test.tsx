import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App';
import { MemoryRouter } from 'react-router-dom';

describe('App shell', () => {
  it('renders five tabs in order', () => {
    render(<MemoryRouter initialEntries={['/kaart']}><AppRoutes /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Tabs' });
    const labels = within(nav).getAllByRole('link').map((a) => a.querySelector('.tab-label')?.textContent);
    expect(labels).toEqual(['Kaart', 'Berg', 'AI', 'Huis', 'Planning']);
  });

  it('defaults to kaart', () => {
    render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Kaart' })).toBeInTheDocument();
  });
});
