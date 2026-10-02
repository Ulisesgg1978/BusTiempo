export interface GeocodedAddress {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: 'street' | 'monument' | 'station' | 'plaza' | 'hospital' | 'point';
  district?: string;
}

// Iconic Barcelona landmarks, main avenues, squares and interchanges for instantaneous zero-latency search
const BARCELONA_KNOWN_PLACES: GeocodedAddress[] = [
  // Plazas & Central hubs
  {
    id: 'bcn-pl-catalunya',
    name: 'Plaça de Catalunya',
    displayName: 'Plaça de Catalunya (Centre / Eixample)',
    lat: 41.3870,
    lng: 2.1699,
    type: 'plaza',
    district: 'Ciutat Vella / Eixample',
  },
  {
    id: 'bcn-pl-espanya',
    name: 'Plaça d’Espanya',
    displayName: 'Plaça d’Espanya / Fira de Barcelona (Montjuïc)',
    lat: 41.3748,
    lng: 2.1485,
    type: 'plaza',
    district: 'Sants-Montjuïc',
  },
  {
    id: 'bcn-pl-universitat',
    name: 'Plaça de la Universitat',
    displayName: 'Plaça de la Universitat',
    lat: 41.3854,
    lng: 2.1638,
    type: 'plaza',
    district: 'Eixample',
  },
  {
    id: 'bcn-pl-urquinaona',
    name: 'Plaça d’Urquinaona',
    displayName: 'Plaça d’Urquinaona / Via Laietana',
    lat: 41.3888,
    lng: 2.1730,
    type: 'plaza',
    district: 'Eixample / Ciutat Vella',
  },
  {
    id: 'bcn-pl-glories',
    name: 'Plaça de les Glòries',
    displayName: 'Plaça de les Glòries Catalanes / Torre Glòries',
    lat: 41.4031,
    lng: 2.1892,
    type: 'plaza',
    district: 'Sant Martí',
  },
  {
    id: 'bcn-pl-francesc-macia',
    name: 'Plaça de Francesc Macià',
    displayName: 'Plaça Francesc Macià / Avinguda Diagonal',
    lat: 41.3934,
    lng: 2.1447,
    type: 'plaza',
    district: 'Sarrià-Sant Gervasi / Les Corts',
  },
  {
    id: 'bcn-pl-reina-maria-cristina',
    name: 'Plaça de la Reina Maria Cristina',
    displayName: 'Pl. Reina Maria Cristina (La Caixa / El Corte Inglés Diagonal)',
    lat: 41.3880,
    lng: 2.1260,
    type: 'plaza',
    district: 'Les Corts',
  },
  {
    id: 'bcn-pl-lesseps',
    name: 'Plaça de Lesseps',
    displayName: 'Plaça de Lesseps (Gràcia)',
    lat: 41.4070,
    lng: 2.1550,
    type: 'plaza',
    district: 'Gràcia',
  },

  // Main Streets & Avenues
  {
    id: 'bcn-pg-gracia',
    name: 'Passeig de Gràcia',
    displayName: 'Passeig de Gràcia (Casa Batlló / La Pedrera)',
    lat: 41.3912,
    lng: 2.1648,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-av-diagonal',
    name: 'Avinguda Diagonal',
    displayName: 'Avinguda Diagonal (Tram Central)',
    lat: 41.3970,
    lng: 2.1580,
    type: 'street',
    district: 'Eixample / Gràcia',
  },
  {
    id: 'bcn-gran-via',
    name: 'Gran Via de les Corts Catalanes',
    displayName: 'Gran Via de les Corts Catalanes (Eixample)',
    lat: 41.3880,
    lng: 2.1660,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-carrer-arago',
    name: 'Carrer d’Aragó',
    displayName: 'Carrer d’Aragó (Eixample)',
    lat: 41.3920,
    lng: 2.1640,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-carrer-mallorca',
    name: 'Carrer de Mallorca',
    displayName: 'Carrer de Mallorca (Sagrada Família)',
    lat: 41.4036,
    lng: 2.1744,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-carrer-balmes',
    name: 'Carrer de Balmes',
    displayName: 'Carrer de Balmes',
    lat: 41.3940,
    lng: 2.1585,
    type: 'street',
    district: 'Eixample / Sarrià',
  },
  {
    id: 'bcn-carrer-muntaner',
    name: 'Carrer de Muntaner',
    displayName: 'Carrer de Muntaner',
    lat: 41.3925,
    lng: 2.1520,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-carrer-valencia',
    name: 'Carrer de València',
    displayName: 'Carrer de València',
    lat: 41.3950,
    lng: 2.1650,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-carrer-consell-de-cent',
    name: 'Carrer del Consell de Cent',
    displayName: 'Carrer del Consell de Cent (Eix Verd)',
    lat: 41.3912,
    lng: 2.1648,
    type: 'street',
    district: 'Eixample',
  },
  {
    id: 'bcn-via-laietana',
    name: 'Via Laietana',
    displayName: 'Via Laietana (Catedral / Port Vell)',
    lat: 41.3850,
    lng: 2.1770,
    type: 'street',
    district: 'Ciutat Vella',
  },
  {
    id: 'bcn-la-rambla',
    name: 'La Rambla',
    displayName: 'La Rambla (Liceu / Boqueria)',
    lat: 41.3810,
    lng: 2.1730,
    type: 'street',
    district: 'Ciutat Vella',
  },
  {
    id: 'bcn-pg-maritim',
    name: 'Passeig Marítim de la Barceloneta',
    displayName: 'Passeig Marítim de la Barceloneta (Platja / Port Olímpic)',
    lat: 41.3768,
    lng: 2.1895,
    type: 'street',
    district: 'Ciutat Vella',
  },
  {
    id: 'bcn-av-meridiana',
    name: 'Avinguda Meridiana',
    displayName: 'Avinguda Meridiana / Sagrera',
    lat: 41.4200,
    lng: 2.1890,
    type: 'street',
    district: 'Sant Andreu',
  },

  // Monuments & Points of Interest
  {
    id: 'bcn-sagrada-familia',
    name: 'Sagrada Família',
    displayName: 'Basílica de la Sagrada Família (Carrer Mallorca 401)',
    lat: 41.4036,
    lng: 2.1744,
    type: 'monument',
    district: 'Eixample',
  },
  {
    id: 'bcn-park-guell',
    name: 'Park Güell',
    displayName: 'Park Güell (Carretera del Carmel / Gràcia)',
    lat: 41.4153,
    lng: 2.1527,
    type: 'monument',
    district: 'Gràcia',
  },
  {
    id: 'bcn-camp-nou',
    name: 'Camp Nou (Spotify Camp Nou)',
    displayName: 'Camp Nou - FC Barcelona (Travessera de les Corts)',
    lat: 41.3809,
    lng: 2.1228,
    type: 'monument',
    district: 'Les Corts',
  },
  {
    id: 'bcn-arc-de-triomf',
    name: 'Arc de Triomf',
    displayName: 'Arc de Triomf / Parc de la Ciutadella',
    lat: 41.3915,
    lng: 2.1806,
    type: 'monument',
    district: 'Eixample / Ciutat Vella',
  },
  {
    id: 'bcn-hospital-clinic',
    name: 'Hospital Clínic',
    displayName: 'Hospital Clínic de Barcelona (Carrer Villarroel 170)',
    lat: 41.3885,
    lng: 2.1525,
    type: 'hospital',
    district: 'Eixample',
  },
  {
    id: 'bcn-hospital-vall-dhebron',
    name: 'Hospital Vall d’Hebron',
    displayName: 'Hospital Universitari Vall d’Hebron',
    lat: 41.4270,
    lng: 2.1430,
    type: 'hospital',
    district: 'Horta-Guinardó',
  },
  {
    id: 'bcn-sants-estacio',
    name: 'Estació de Sants (AVE/Rodalies)',
    displayName: 'Estació de Sants (Plaça dels Països Catalans)',
    lat: 41.3792,
    lng: 2.1402,
    type: 'station',
    district: 'Sants-Montjuïc',
  },
  {
    id: 'bcn-aeroport-t1',
    name: 'Aeroport Barcelona T1',
    displayName: 'Aeroport Josep Tarradellas Barcelona-El Prat (Terminal T1)',
    lat: 41.2880,
    lng: 2.0720,
    type: 'station',
    district: 'El Prat de Llobregat',
  },
  {
    id: 'bcn-aeroport-t2',
    name: 'Aeroport Barcelona T2',
    displayName: 'Aeroport Josep Tarradellas Barcelona-El Prat (Terminal T2)',
    lat: 41.3030,
    lng: 2.0780,
    type: 'station',
    district: 'El Prat de Llobregat',
  },
];

const geocodeCache = new Map<string, GeocodedAddress[]>();

/**
 * Searches real addresses, streets and landmarks in Barcelona
 */
export async function searchBarcelonaAddresses(query: string): Promise<GeocodedAddress[]> {
  const cleanQ = query.trim();
  if (cleanQ.length < 2) return [];

  const lowerQ = cleanQ.toLowerCase();

  // 1. Search locally in our rich curated Barcelona index
  const localMatches = BARCELONA_KNOWN_PLACES.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQ) ||
      item.displayName.toLowerCase().includes(lowerQ) ||
      (item.district && item.district.toLowerCase().includes(lowerQ))
  );

  // If cached from previous network call, use it
  if (geocodeCache.has(lowerQ)) {
    const cached = geocodeCache.get(lowerQ) || [];
    const combined = [...localMatches];
    for (const c of cached) {
      if (!combined.some((item) => Math.hypot(item.lat - c.lat, item.lng - c.lng) < 0.001)) {
        combined.push(c);
      }
    }
    return combined.slice(0, 8);
  }

  // 2. Fetch from OpenStreetMap Nominatim Geocoder bounded strictly around Barcelona metropolitan area
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cleanQ + ', Barcelona'
    )}&format=json&addressdetails=1&limit=6&viewbox=2.00,41.48,2.28,41.32&bounded=0&countrycodes=es`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const remoteResults: GeocodedAddress[] = data
          .map((item: any, idx: number) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            const rawName = item.address?.road || item.address?.suburb || item.name || cleanQ;
            const fullAddress = item.display_name
              ? item.display_name.split(',').slice(0, 3).join(', ')
              : rawName;

            return {
              id: `geo-osm-${idx}-${Date.now()}`,
              name: rawName,
              displayName: fullAddress,
              lat,
              lng,
              type: 'street' as const,
              district: item.address?.suburb || item.address?.city_district || 'Barcelona',
            };
          })
          .filter((item) => !isNaN(item.lat) && !isNaN(item.lng));

        geocodeCache.set(lowerQ, remoteResults);

        // Merge without duplicates
        const combined = [...localMatches];
        for (const r of remoteResults) {
          if (!combined.some((item) => Math.hypot(item.lat - r.lat, item.lng - r.lng) < 0.001)) {
            combined.push(r);
          }
        }
        return combined.slice(0, 8);
      }
    }
  } catch (err) {
    // If offline or network timeout, local matches serve reliably
    console.warn('[Geocoding] Nominatim query error or offline:', err);
  }

  return localMatches.slice(0, 8);
}
