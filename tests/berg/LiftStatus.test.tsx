import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiftStatus } from '../../src/features/berg/LiftStatus';

const now = new Date('2027-03-02T09:30:00Z');

describe('LiftStatus', () => {
  it('lists closed lifts first and shows when it was updated', () => {
    render(
      <LiftStatus
        now={now}
        items={[
          { id: 'lift:stubnerkogel i', name: 'Stubnerkogelbahn I', kind: 'lift', is_open: true, updated_at: '2027-03-02T09:15:00Z' },
          { id: 'lift:graukogel i', name: 'Graukogelbahn I', kind: 'lift', is_open: false, updated_at: '2027-03-02T09:15:00Z' },
        ]}
      />,
    );
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Graukogelbahn I');
    expect(screen.getByText(/15 min geleden/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Officiële status' })).toHaveAttribute('href', expect.stringContaining('skigastein'));
  });

  it('says the status is unknown without data', () => {
    render(<LiftStatus now={now} items={[]} />);
    expect(screen.getByText('Liftstatus onbekend — bekijk de officiële status.')).toBeInTheDocument();
  });

  it('warns when the data is older than an hour', () => {
    render(<LiftStatus now={now} items={[{ id: 'lift:a', name: 'A', kind: 'lift', is_open: true, updated_at: '2027-03-01T15:00:00Z' }]} />);
    expect(screen.getByText(/verouderd/)).toBeInTheDocument();
  });
});
