/** Google Maps details for a place, fetched ahead of the trip by scripts/fetch-google-places.ts. */
export interface GoogleInfo {
  placeId: string;
  rating?: number;
  ratingCount?: number;
  /** 1 (€) … 4 (€€€€) */
  priceLevel?: number;
  mapsUri?: string;
  summary?: string;
  phone?: string;
  /** One line per weekday, as Google words them. */
  hours?: string[];
  permanentlyClosed?: boolean;
  /** Short Dutch labels such as "Terras" or "Livemuziek". */
  tags: string[];
  fetchedAt: string;
}
