import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceDetails } from '../../src/features/map/PlaceDetails';

const base = { id: 'osm:node/1', name: 'Bergstadl', kind: 'restaurant' as const, lat: 1, lng: 1, nodeId: 'n' };

describe('PlaceDetails Google info', () => {
  it('shows rating, review count and price', () => {
    const google = { placeId: 'x', rating: 4.5, ratingCount: 312, priceLevel: 2, tags: ['Terras'], mapsUri: 'https://maps.google.com/?cid=1', fetchedAt: '2027-02-01T00:00:00Z' };
    render(<PlaceDetails place={{ ...base, google }} />);
    expect(screen.getByText('★ 4,5')).toBeInTheDocument();
    expect(screen.getByText(/312 recensies op Google/)).toBeInTheDocument();
    expect(screen.getByText('Terras')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google Maps' })).toBeInTheDocument();
  });
  it('hides the tags nearly every place has', () => {
    const google = { placeId: 'x', tags: ['Bier', 'Kindermenu', 'Honden welkom', 'Panorama'], fetchedAt: '2027-02-01T00:00:00Z' };
    render(<PlaceDetails place={{ ...base, google }} />);
    expect(screen.getByText('Panorama')).toBeInTheDocument();
    for (const t of ['Bier', 'Kindermenu', 'Honden welkom']) expect(screen.queryByText(t)).not.toBeInTheDocument();
  });
  it('shows nothing extra without Google info', () => {
    render(<PlaceDetails place={base} />);
    expect(screen.queryByText(/recensies/)).not.toBeInTheDocument();
  });
});
