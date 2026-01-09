import { Record, FieldSet } from 'airtable';
import { OmdbGetResponse, OmdbSearchResult } from '../omdb/OmdbModels';
import { createMockRecord, MockRecordOptions } from './factories/AirtableRecordFactory';
import { 
  createMockOmdbGetResponse, 
  createMockOmdbSearchResult,
  createMockOmdbSearchResponse,
  MockOmdbOptions 
} from './factories/OmdbResponseFactory';

// Mock dependencies first before importing the module
jest.mock('../EnvSetup', () => ({
  AIRTABLE_API_KEY: 'test-airtable-key',
  AIRTABLE_BASE_ID: 'test-base-id',
  AIRTABLE_TABLE_ID: 'test-table-id',
  OMDB_API_KEY: 'test-omdb-key'
}));

jest.mock('lodash', () => ({ 
  partition: jest.fn() 
}));

// Create mocks for Airtable
const mockSelect = jest.fn().mockReturnValue({ all: jest.fn() });
const mockTable = jest.fn().mockReturnValue({ select: mockSelect });
const mockBase = jest.fn().mockReturnValue(mockTable);
const mockAirtable = jest.fn().mockImplementation(() => ({
  base: mockBase
}));

jest.mock('airtable', () => {
  return mockAirtable;
});

import { EnrichmentService } from '../EnrichmentService';
import { OmdbService } from '../omdb/OmdbService';
import { partition } from 'lodash';
import Airtable from 'airtable';

describe('EnrichmentService', () => {
  let enrichmentService: EnrichmentService;
  let mockOmdbService: jest.Mocked<OmdbService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup OMDB Service mock
    mockOmdbService = {
      getFullEntryById: jest.fn(),
      maybeGetEntry: jest.fn(),
      runtimeToNumber: jest.fn()
    } as any;

    // Create service instance with mocked dependencies
    enrichmentService = new EnrichmentService(
      'test-base-id',
      'test-table-id',
      mockOmdbService
    );
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const defaultService = new EnrichmentService();
      expect(defaultService).toBeInstanceOf(EnrichmentService);
    });

    it('should initialize with custom parameters', () => {
      const customService = new EnrichmentService(
        'custom-base-id',
        'custom-table-id',
        mockOmdbService
      );
      expect(customService).toBeInstanceOf(EnrichmentService);
    });

    it('should setup Airtable client with correct API key', () => {
      new EnrichmentService();
      expect(mockAirtable).toHaveBeenCalledWith({
        apiKey: 'test-airtable-key'
      });
    });

    it('should setup base and table with correct IDs', () => {
      new EnrichmentService();
      expect(mockBase).toHaveBeenCalledWith('test-base-id');
      expect(mockTable).toHaveBeenCalledWith('test-table-id');
    });
  });

  describe('enrichMetadata', () => {
    it('should partition records by IMDB ID presence', async () => {
      const recordsWithImdbId = [
        createMockRecord({ hasImdbId: true, id: 'rec1' }),
        createMockRecord({ hasImdbId: true, id: 'rec2' })
      ];
      const recordsWithoutImdbId = [
        createMockRecord({ hasImdbId: false, id: 'rec3' }),
        createMockRecord({ hasImdbId: false, id: 'rec4' })
      ];
      const allRecords = [...recordsWithImdbId, ...recordsWithoutImdbId];

      mockSelect().all.mockResolvedValue(allRecords);
      (partition as jest.Mock).mockReturnValue([recordsWithImdbId, recordsWithoutImdbId]);

      await enrichmentService.enrichMetadata();

      expect(partition).toHaveBeenCalledWith(
        allRecords,
        expect.any(Function)
      );
    });

    it('should process records with IMDB IDs', async () => {
      const recordsWithImdbId: Record<FieldSet>[] = [createMockRecord({ hasImdbId: true })];
      const recordsWithoutImdbId: Record<FieldSet>[] = [];

      mockSelect().all.mockResolvedValue(recordsWithImdbId);
      (partition as jest.Mock).mockReturnValue([recordsWithImdbId, recordsWithoutImdbId]);

      // Mock the OMDB service to return data
      const mockOmdbResponse = createMockOmdbGetResponse();
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService.enrichMetadata();

      expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
    });

    it('should process records without IMDB IDs', async () => {
      const recordsWithImdbId: Record<FieldSet>[] = [];
      const recordsWithoutImdbId: Record<FieldSet>[] = [createMockRecord({ hasImdbId: false, title: 'Test Movie' })];

      mockSelect().all.mockResolvedValue(recordsWithoutImdbId);
      (partition as jest.Mock).mockReturnValue([recordsWithImdbId, recordsWithoutImdbId]);

      // Mock search to return results
      const mockSearchResult = createMockOmdbSearchResult();
      const mockOmdbResponse = createMockOmdbGetResponse();
      mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService.enrichMetadata();

      expect(mockOmdbService.maybeGetEntry).toHaveBeenCalled();
    });

    it('should handle empty record set', async () => {
      mockSelect().all.mockResolvedValue([]);
      (partition as jest.Mock).mockReturnValue([[], []]);

      await enrichmentService.enrichMetadata();

      expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
      expect(mockOmdbService.maybeGetEntry).not.toHaveBeenCalled();
    });
  });

  describe('maybeUpdateRecordWithImdbId', () => {
    let mockRecord: any;

    beforeEach(() => {
      mockRecord = createMockRecord({ hasImdbId: true });
    });

    it('should skip update when cover is up to date and data is complete', async () => {
      mockRecord = createMockRecord({ 
        hasImdbId: true, 
        hasCover: true, 
        hasRuntime: true, 
        hasReleaseYear: true 
      });

      await enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);

      expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
      expect(mockRecord.updateFields).not.toHaveBeenCalled();
    });

    it('should fetch OMDB data when update is needed', async () => {
      const mockOmdbResponse = createMockOmdbGetResponse();
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);

      expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
    });

    it('should handle OMDB API failure gracefully', async () => {
      mockOmdbService.getFullEntryById.mockResolvedValue(undefined);

      await enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);

      expect(mockRecord.updateFields).not.toHaveBeenCalled();
    });

    it('should call updateRecordWithOmdbEntry when OMDB data is found', async () => {
      const mockOmdbResponse = createMockOmdbGetResponse();
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      // Spy on the private method
      const updateSpy = jest.spyOn(enrichmentService as any, 'updateRecordWithOmdbEntry');
      updateSpy.mockResolvedValue(undefined);

      await enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);

      expect(updateSpy).toHaveBeenCalledWith(mockRecord, mockOmdbResponse);
    });
  });

  describe('updateRecordWithOmdbEntry', () => {
    let mockRecord: any;
    let mockOmdbResponse: OmdbGetResponse;

    beforeEach(() => {
      mockRecord = createMockRecord({ hasImdbId: false });
      mockOmdbResponse = createMockOmdbGetResponse();
    });

    it('should update IMDB ID when missing', async () => {
      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockRecord.updateFields).toHaveBeenCalledWith(
        expect.objectContaining({
          'imdb id': 'tt1234567'
        }),
        { typecast: true }
      );
    });

    it('should update cover when poster exists and reviews are great', async () => {
      mockRecord = createMockRecord({ 
        hasImdbId: false,
        reviews: { kev: '🥰', net: '🥰' }
      });

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockRecord.updateFields).toHaveBeenCalledWith(
        expect.objectContaining({
          'cover': expect.arrayContaining([
            expect.objectContaining({
              url: 'https://example.com/poster.jpg'
            })
          ])
        }),
        { typecast: true }
      );
    });

    it('should not update cover when reviews are not unanimously great', async () => {
      mockRecord = createMockRecord({ 
        hasImdbId: false,
        reviews: { kev: '👍', net: '🥰' }
      });

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      const updateCall = mockRecord.updateFields.mock.calls[0]?.[0];
      if (updateCall) {
        expect(updateCall['cover']).toBeUndefined();
      }
    });

    it('should update runtime when missing and valid', async () => {
      mockOmdbService.runtimeToNumber.mockReturnValue(120);

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockOmdbService.runtimeToNumber).toHaveBeenCalledWith('120 min');
      expect(mockRecord.updateFields).toHaveBeenCalledWith(
        expect.objectContaining({
          'runtime (minutes)': 120
        }),
        { typecast: true }
      );
    });

    it('should not update runtime when invalid', async () => {
      mockOmdbService.runtimeToNumber.mockReturnValue(NaN);

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      const updateCall = mockRecord.updateFields.mock.calls[0]?.[0];
      if (updateCall) {
        expect(updateCall['runtime (minutes)']).toBeUndefined();
      }
    });

    it('should update release year when missing', async () => {
      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockRecord.updateFields).toHaveBeenCalledWith(
        expect.objectContaining({
          'release year': '2023'
        }),
        { typecast: true }
      );
    });

    it('should update release year when different', async () => {
      mockRecord = createMockRecord({ 
        hasImdbId: false,
        hasReleaseYear: true
      });
      // Override release year in mock's get method
      mockRecord.get.mockImplementation((field: string) => {
        if (field === 'release year') return '2022';
        return mockRecord.fields[field];
      });

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockRecord.updateFields).toHaveBeenCalledWith(
        expect.objectContaining({
          'release year': '2023'
        }),
        { typecast: true }
      );
    });

    it('should not update when no fields need updating', async () => {
      mockRecord = createMockRecord({ 
        hasImdbId: true,
        hasCover: true,
        hasRuntime: true,
        hasReleaseYear: true
      });

      await enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);

      expect(mockRecord.updateFields).not.toHaveBeenCalled();
    });
  });

  describe('maybeUpdateRecordWithTitle', () => {
    describe('TV show format', () => {
      it('should clean title by removing season information', async () => {
        const mockRecord = createMockRecord({
          hasImdbId: false,
          format: 'television show',
          title: 'Test Show: Season 1'
        });

        const mockSearchResult = createMockOmdbSearchResult({ type: 'series' });
        const mockOmdbResponse = createMockOmdbGetResponse({ type: 'series' });
        
        mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
        mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

        await enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);

        expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith(
          'test show',
          'series',
          undefined
        );
      });
    });

    describe('Feature film format', () => {
      it('should search with movie type', async () => {
        const mockRecord = createMockRecord({
          hasImdbId: false,
          format: 'feature film',
          title: 'Test Movie'
        });

        const mockSearchResult = createMockOmdbSearchResult({ type: 'movie' });
        const mockOmdbResponse = createMockOmdbGetResponse({ type: 'movie' });
        
        mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
        mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

        await enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);

        expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith(
          'test movie',
          'movie',
          undefined
        );
      });
    });

    describe('Year extraction', () => {
      it('should extract year from title and use it in search', async () => {
        const mockRecord = createMockRecord({
          hasImdbId: false,
          format: 'feature film',
          title: 'Test Movie (2023)'
        });

        const mockSearchResult = createMockOmdbSearchResult();
        const mockOmdbResponse = createMockOmdbGetResponse();
        
        mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
        mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

        await enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);

        expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith(
          'test movie',
          'movie',
          '2023'
        );
      });
    });

    describe('Other formats', () => {
      it('should search without type restriction for documentary', async () => {
        const mockRecord = createMockRecord({
          hasImdbId: false,
          format: 'documentary',
          title: 'Test Documentary'
        });

        const mockSearchResult = createMockOmdbSearchResult();
        const mockOmdbResponse = createMockOmdbGetResponse();
        
        mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
        mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

        await enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);

        expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith(
          'test documentary',
          undefined,
          undefined
        );
      });
    });
  });

  describe('maybeUpdateRecordWithWorkingTitle', () => {
    let mockRecord: any;

    beforeEach(() => {
      mockRecord = createMockRecord({ hasImdbId: false });
    });

    it('should handle successful search with single result', async () => {
      const mockSearchResult = createMockOmdbSearchResult();
      const mockOmdbResponse = createMockOmdbGetResponse();
      
      mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService['maybeUpdateRecordWithWorkingTitle'](
        false,
        mockRecord,
        'test movie',
        'movie',
        '2023'
      );

      expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith(
        'test movie',
        'movie',
        '2023'
      );
      expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
    });

    it('should handle ambiguous search results', async () => {
      const mockSearchResults = [
        createMockOmdbSearchResult({ imdbId: 'tt1234567' }),
        createMockOmdbSearchResult({ imdbId: 'tt7654321' })
      ];
      const mockOmdbResponse = createMockOmdbGetResponse();
      
      mockOmdbService.maybeGetEntry.mockResolvedValue(mockSearchResults);
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService['maybeUpdateRecordWithWorkingTitle'](
        false,
        mockRecord,
        'test movie',
        'movie',
        '2023'
      );

      // Should pick first result and log about ambiguity
      expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
    });

    it('should handle failed search with retry', async () => {
      // First search fails
      mockOmdbService.maybeGetEntry.mockResolvedValueOnce(undefined);
      // Second search with cleaned title succeeds
      const mockSearchResult = createMockOmdbSearchResult();
      const mockOmdbResponse = createMockOmdbGetResponse();
      mockOmdbService.maybeGetEntry.mockResolvedValueOnce([mockSearchResult]);
      mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);

      await enrichmentService['maybeUpdateRecordWithWorkingTitle'](
        false,
        mockRecord,
        'test-movie!',  // Title with special character
        'movie',
        '2023'
      );

      // Should retry with cleaned title
      expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledTimes(2);
      expect(mockOmdbService.maybeGetEntry).toHaveBeenLastCalledWith(
        'test movie ',
        'movie',
        '2023'
      );
    });

    it('should handle complete search failure', async () => {
      mockOmdbService.maybeGetEntry.mockResolvedValue(undefined);

      await enrichmentService['maybeUpdateRecordWithWorkingTitle'](
        false,
        mockRecord,
        'nonexistent movie',
        'movie',
        '2023'
      );

      expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
    });
  });
});