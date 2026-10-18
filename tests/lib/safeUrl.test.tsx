import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { safeUrl } from '../../src/lib/safeUrl';
import { PlaceDetails } from '../../src/features/map/PlaceDetails';

describe('safeUrl', () => {
  it.each([
    ['https://example.at/menu.pdf', 'https://example.at/menu.pdf'],
    ['http://example.at', 'http://example.at'],
    ['  https://x.at  ', 'https://x.at'],
    ['javascript:alert(1)', undefined],
    ['JaVaScRiPt:alert(1)', undefined],
    ['data:text/html,hi', undefined],
    ['www.example.at', 'https://www.example.at'],
    ['', undefined],
    [null, undefined],
  ])('%s → %s', (input, expected) => expect(safeUrl(input)).toBe(expected));
});

describe('PlaceDetails', () => {
  it('never renders a javascript: link', () => {
    render(<PlaceDetails place={{ id: 'x', name: 'Evil', kind: 'dinner', lat: 0, lng: 0, nodeId: null, website: 'javascript:alert(1)', menuUrl: 'javascript:alert(2)' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
