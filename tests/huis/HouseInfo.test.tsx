import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HouseInfo, type HouseSection } from '../../src/features/huis/HouseInfo';

const sections: HouseSection[] = [
  { section: 'wellness', title: 'Zwembad & spa', markdown: 'Openingstijden zwembad: [PLACEHOLDER]', sort: 50 },
  { section: 'algemeen', title: 'Het huis', markdown: '**Panorama Spa Lodges**\nKötschachtaler Straße 5, 5640 Bad Gastein', sort: 10 },
  { section: 'booking', title: 'Boeking', markdown: '[PLACEHOLDER]', sort: 80 },
];

describe('HouseInfo', () => {
  it('renders sections in sort order', () => {
    render(<HouseInfo sections={sections} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Het huis', 'Zwembad & spa', 'Boeking']);
  });

  it('highlights placeholders', () => {
    const { container } = render(<HouseInfo sections={sections} isAdmin={false} onSave={vi.fn()} />);
    expect(container.querySelectorAll('.placeholder').length).toBe(2);
  });

  it('hides the Booking button while the link is a placeholder', () => {
    render(<HouseInfo sections={sections} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Open in Booking' })).not.toBeInTheDocument();
  });

  it('shows the Booking button once a link is filled in', () => {
    const withLink = sections.map((s) => (s.section === 'booking' ? { ...s, markdown: 'Boeking: https://www.booking.com/hotel/at/schiller.html' } : s));
    render(<HouseInfo sections={withLink} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Open in Booking' })).toHaveAttribute('href', 'https://www.booking.com/hotel/at/schiller.html');
  });

  it('offers a route to the address', () => {
    render(<HouseInfo sections={sections} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Route naar het huis' }).getAttribute('href')).toContain('K%C3%B6tschachtaler');
  });

  it('lets only admins edit, and saves the new text', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<HouseInfo sections={sections} isAdmin={false} onSave={onSave} />);
    expect(screen.queryByRole('button', { name: 'Bewerken' })).not.toBeInTheDocument();
    rerender(<HouseInfo sections={sections} isAdmin onSave={onSave} />);
    const wellness = screen.getByRole('region', { name: 'Zwembad & spa' });
    await userEvent.click(within(wellness).getByRole('button', { name: 'Bewerken' }));
    const box = within(wellness).getByRole('textbox');
    await userEvent.clear(box);
    await userEvent.type(box, 'Zwembad 7:00–21:00');
    await userEvent.click(within(wellness).getByRole('button', { name: 'Opslaan' }));
    expect(onSave).toHaveBeenCalledWith('wellness', 'Zwembad 7:00–21:00');
  });

  it('never renders scripts from markdown', () => {
    const evil = [{ section: 'regels', title: 'Regels', markdown: '<img src=x onerror="alert(1)"><script>alert(2)</script>', sort: 1 }];
    const { container } = render(<HouseInfo sections={evil} isAdmin={false} onSave={vi.fn()} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });
});
