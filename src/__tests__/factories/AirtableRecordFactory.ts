import { Record, FieldSet, Attachment } from 'airtable';

export interface MockRecordOptions {
  id?: string;
  fields?: { [key: string]: any };
  hasImdbId?: boolean;
  hasCover?: boolean;
  hasRuntime?: boolean;
  hasReleaseYear?: boolean;
  reviews?: { kev: string; net: string };
  format?: string;
  title?: string;
}

export function createMockRecord(options: MockRecordOptions = {}): Record<FieldSet> {
  const {
    id = 'rec123',
    fields = {},
    hasImdbId = false,
    hasCover = false,
    hasRuntime = false,
    hasReleaseYear = false,
    reviews = { kev: '👍', net: '👍' },
    format = 'feature film',
    title = 'Test Movie'
  } = options;

  const mockFields: { [key: string]: any } = {
    'id': id,
    'title': title,
    'format': format,
    'kev review': reviews.kev,
    'net review': reviews.net,
    ...fields
  };

  if (hasImdbId) {
    mockFields['imdb id'] = 'tt1234567';
  }

  if (hasCover) {
    mockFields['cover'] = [{
      id: 'att123',
      url: 'https://example.com/existing-cover.jpg',
      filename: 'cover.jpg'
    }] as Attachment[];
  }

  if (hasRuntime) {
    mockFields['runtime (minutes)'] = 120;
  }

  if (hasReleaseYear) {
    mockFields['release year'] = '2023';
  }

  const mockRecord = {
    id: id,
    get: jest.fn((field: string) => mockFields[field]),
    updateFields: jest.fn().mockResolvedValue(undefined),
    fields: mockFields
  } as any;

  return mockRecord;
}