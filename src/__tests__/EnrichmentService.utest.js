"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const AirtableRecordFactory_1 = require("./factories/AirtableRecordFactory");
const OmdbResponseFactory_1 = require("./factories/OmdbResponseFactory");
// Mock dependencies first before importing the module
jest.mock('../EnvSetup', () => ({
    AIRTABLE_API_KEY: 'test-airtable-key',
    AIRTABLE_BASE_ID: 'test-base-id',
    AIRTABLE_TABLE_ID: 'test-table-id',
    OMDB_API_KEY: 'test-omdb-key',
}));
jest.mock('lodash', () => ({
    partition: jest.fn(),
}));
// Create mocks for Airtable
const mockSelect = jest.fn().mockReturnValue({ all: jest.fn() });
const mockTable = jest.fn().mockReturnValue({ select: mockSelect });
const mockBase = jest.fn().mockReturnValue(mockTable);
const mockAirtable = jest.fn().mockImplementation(() => ({
    base: mockBase,
}));
jest.mock('airtable', () => {
    return mockAirtable;
});
const EnrichmentService_1 = require("../EnrichmentService");
const lodash_1 = require("lodash");
describe('EnrichmentService', () => {
    let enrichmentService;
    let mockOmdbService;
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Setup OMDB Service mock
        mockOmdbService = {
            getFullEntryById: jest.fn(),
            maybeGetEntry: jest.fn(),
            runtimeToNumber: jest.fn(),
        };
        // Create service instance with mocked dependencies
        enrichmentService = new EnrichmentService_1.EnrichmentService('test-base-id', 'test-table-id', mockOmdbService);
    });
    describe('constructor', () => {
        it('should initialize with default parameters', () => {
            const defaultService = new EnrichmentService_1.EnrichmentService();
            expect(defaultService).toBeInstanceOf(EnrichmentService_1.EnrichmentService);
        });
        it('should initialize with custom parameters', () => {
            const customService = new EnrichmentService_1.EnrichmentService('custom-base-id', 'custom-table-id', mockOmdbService);
            expect(customService).toBeInstanceOf(EnrichmentService_1.EnrichmentService);
        });
        it('should setup Airtable client with correct API key', () => {
            new EnrichmentService_1.EnrichmentService();
            expect(mockAirtable).toHaveBeenCalledWith({
                apiKey: 'test-airtable-key',
            });
        });
        it('should setup base and table with correct IDs', () => {
            new EnrichmentService_1.EnrichmentService();
            expect(mockBase).toHaveBeenCalledWith('test-base-id');
            expect(mockTable).toHaveBeenCalledWith('test-table-id');
        });
    });
    describe('enrichMetadata', () => {
        it('should partition records by IMDB ID presence', () => __awaiter(void 0, void 0, void 0, function* () {
            const recordsWithImdbId = [
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: true, id: 'rec1' }),
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: true, id: 'rec2' }),
            ];
            const recordsWithoutImdbId = [
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: false, id: 'rec3' }),
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: false, id: 'rec4' }),
            ];
            const allRecords = [...recordsWithImdbId, ...recordsWithoutImdbId];
            mockSelect().all.mockResolvedValue(allRecords);
            lodash_1.partition.mockReturnValue([
                recordsWithImdbId,
                recordsWithoutImdbId,
            ]);
            yield enrichmentService.enrichMetadata();
            expect(lodash_1.partition).toHaveBeenCalledWith(allRecords, expect.any(Function));
        }));
        it('should process records with IMDB IDs', () => __awaiter(void 0, void 0, void 0, function* () {
            const recordsWithImdbId = [
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: true }),
            ];
            const recordsWithoutImdbId = [];
            mockSelect().all.mockResolvedValue(recordsWithImdbId);
            lodash_1.partition.mockReturnValue([
                recordsWithImdbId,
                recordsWithoutImdbId,
            ]);
            // Mock the OMDB service to return data
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService.enrichMetadata();
            expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
        }));
        it('should process records without IMDB IDs', () => __awaiter(void 0, void 0, void 0, function* () {
            const recordsWithImdbId = [];
            const recordsWithoutImdbId = [
                (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: false, title: 'Test Movie' }),
            ];
            mockSelect().all.mockResolvedValue(recordsWithoutImdbId);
            lodash_1.partition.mockReturnValue([
                recordsWithImdbId,
                recordsWithoutImdbId,
            ]);
            // Mock search to return results
            const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)();
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService.enrichMetadata();
            expect(mockOmdbService.maybeGetEntry).toHaveBeenCalled();
        }));
        it('should handle empty record set', () => __awaiter(void 0, void 0, void 0, function* () {
            mockSelect().all.mockResolvedValue([]);
            lodash_1.partition.mockReturnValue([[], []]);
            yield enrichmentService.enrichMetadata();
            expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
            expect(mockOmdbService.maybeGetEntry).not.toHaveBeenCalled();
        }));
    });
    describe('maybeUpdateRecordWithImdbId', () => {
        let mockRecord;
        beforeEach(() => {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: true });
        });
        it('should skip update when cover is up to date and data is complete', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                hasImdbId: true,
                hasCover: true,
                hasRuntime: true,
                hasReleaseYear: true,
            });
            yield enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);
            expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
            expect(mockRecord.updateFields).not.toHaveBeenCalled();
        }));
        it('should fetch OMDB data when update is needed', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);
            expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
        }));
        it('should handle OMDB API failure gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockOmdbService.getFullEntryById.mockResolvedValue(undefined);
            yield enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);
            expect(mockRecord.updateFields).not.toHaveBeenCalled();
        }));
        it('should call updateRecordWithOmdbEntry when OMDB data is found', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            // Spy on the private method
            const updateSpy = jest.spyOn(enrichmentService, 'updateRecordWithOmdbEntry');
            updateSpy.mockResolvedValue(undefined);
            yield enrichmentService['maybeUpdateRecordWithImdbId'](mockRecord);
            expect(updateSpy).toHaveBeenCalledWith(mockRecord, mockOmdbResponse);
        }));
    });
    describe('updateRecordWithOmdbEntry', () => {
        let mockRecord;
        let mockOmdbResponse;
        beforeEach(() => {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: false });
            mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
        });
        it('should update IMDB ID when missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockRecord.updateFields).toHaveBeenCalledWith(expect.objectContaining({
                'imdb id': 'tt1234567',
            }), { typecast: true });
        }));
        it('should update cover when poster exists and reviews are great', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                hasImdbId: false,
                reviews: { kev: '🥰', net: '🥰' },
            });
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockRecord.updateFields).toHaveBeenCalledWith(expect.objectContaining({
                cover: expect.arrayContaining([
                    expect.objectContaining({
                        url: 'https://example.com/poster.jpg',
                    }),
                ]),
            }), { typecast: true });
        }));
        it('should not update cover when reviews are not unanimously great', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                hasImdbId: false,
                reviews: { kev: '👍', net: '🥰' },
            });
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            const updateCall = (_a = mockRecord.updateFields.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
            if (updateCall) {
                expect(updateCall['cover']).toBeUndefined();
            }
        }));
        it('should update runtime when missing and valid', () => __awaiter(void 0, void 0, void 0, function* () {
            mockOmdbService.runtimeToNumber.mockReturnValue(120);
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockOmdbService.runtimeToNumber).toHaveBeenCalledWith('120 min');
            expect(mockRecord.updateFields).toHaveBeenCalledWith(expect.objectContaining({
                'runtime (minutes)': 120,
            }), { typecast: true });
        }));
        it('should not update runtime when invalid', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            mockOmdbService.runtimeToNumber.mockReturnValue(NaN);
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            const updateCall = (_a = mockRecord.updateFields.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
            if (updateCall) {
                expect(updateCall['runtime (minutes)']).toBeUndefined();
            }
        }));
        it('should update release year when missing', () => __awaiter(void 0, void 0, void 0, function* () {
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockRecord.updateFields).toHaveBeenCalledWith(expect.objectContaining({
                'release year': '2023',
            }), { typecast: true });
        }));
        it('should update release year when different', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                hasImdbId: false,
                hasReleaseYear: true,
            });
            // Override release year in mock's get method
            mockRecord.get.mockImplementation((field) => {
                if (field === 'release year')
                    return '2022';
                return mockRecord.fields[field];
            });
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockRecord.updateFields).toHaveBeenCalledWith(expect.objectContaining({
                'release year': '2023',
            }), { typecast: true });
        }));
        it('should not update when no fields need updating', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                hasImdbId: true,
                hasCover: true,
                hasRuntime: true,
                hasReleaseYear: true,
            });
            yield enrichmentService['updateRecordWithOmdbEntry'](mockRecord, mockOmdbResponse);
            expect(mockRecord.updateFields).not.toHaveBeenCalled();
        }));
    });
    describe('maybeUpdateRecordWithTitle', () => {
        describe('TV show format', () => {
            it('should clean title by removing season information', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                    hasImdbId: false,
                    format: 'television show',
                    title: 'Test Show: Season 1',
                });
                const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)({ type: 'series' });
                const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)({ type: 'series' });
                mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
                mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
                yield enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);
                expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith('test show', 'series', undefined);
            }));
        });
        describe('Feature film format', () => {
            it('should search with movie type', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                    hasImdbId: false,
                    format: 'feature film',
                    title: 'Test Movie',
                });
                const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)({ type: 'movie' });
                const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)({ type: 'movie' });
                mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
                mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
                yield enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);
                expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith('test movie', 'movie', undefined);
            }));
        });
        describe('Year extraction', () => {
            it('should extract year from title and use it in search', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                    hasImdbId: false,
                    format: 'feature film',
                    title: 'Test Movie (2023)',
                });
                const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)();
                const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
                mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
                mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
                yield enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);
                expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith('test movie', 'movie', '2023');
            }));
        });
        describe('Other formats', () => {
            it('should search without type restriction for documentary', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({
                    hasImdbId: false,
                    format: 'documentary',
                    title: 'Test Documentary',
                });
                const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)();
                const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
                mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
                mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
                yield enrichmentService['maybeUpdateRecordWithTitle'](mockRecord);
                expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith('test documentary', undefined, undefined);
            }));
        });
    });
    describe('maybeUpdateRecordWithWorkingTitle', () => {
        let mockRecord;
        beforeEach(() => {
            mockRecord = (0, AirtableRecordFactory_1.createMockRecord)({ hasImdbId: false });
        });
        it('should handle successful search with single result', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)();
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.maybeGetEntry.mockResolvedValue([mockSearchResult]);
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService['maybeUpdateRecordWithWorkingTitle'](false, mockRecord, 'test movie', 'movie', '2023');
            expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledWith('test movie', 'movie', '2023');
            expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
        }));
        it('should handle ambiguous search results', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockSearchResults = [
                (0, OmdbResponseFactory_1.createMockOmdbSearchResult)({ imdbId: 'tt1234567' }),
                (0, OmdbResponseFactory_1.createMockOmdbSearchResult)({ imdbId: 'tt7654321' }),
            ];
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.maybeGetEntry.mockResolvedValue(mockSearchResults);
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService['maybeUpdateRecordWithWorkingTitle'](false, mockRecord, 'test movie', 'movie', '2023');
            // Should pick first result and log about ambiguity
            expect(mockOmdbService.getFullEntryById).toHaveBeenCalledWith('tt1234567');
        }));
        it('should handle failed search with retry', () => __awaiter(void 0, void 0, void 0, function* () {
            // First search fails
            mockOmdbService.maybeGetEntry.mockResolvedValueOnce(undefined);
            // Second search with cleaned title succeeds
            const mockSearchResult = (0, OmdbResponseFactory_1.createMockOmdbSearchResult)();
            const mockOmdbResponse = (0, OmdbResponseFactory_1.createMockOmdbGetResponse)();
            mockOmdbService.maybeGetEntry.mockResolvedValueOnce([mockSearchResult]);
            mockOmdbService.getFullEntryById.mockResolvedValue(mockOmdbResponse);
            yield enrichmentService['maybeUpdateRecordWithWorkingTitle'](false, mockRecord, 'test-movie!', // Title with special character
            'movie', '2023');
            // Should retry with cleaned title
            expect(mockOmdbService.maybeGetEntry).toHaveBeenCalledTimes(2);
            expect(mockOmdbService.maybeGetEntry).toHaveBeenLastCalledWith('test movie ', 'movie', '2023');
        }));
        it('should handle complete search failure', () => __awaiter(void 0, void 0, void 0, function* () {
            mockOmdbService.maybeGetEntry.mockResolvedValue(undefined);
            yield enrichmentService['maybeUpdateRecordWithWorkingTitle'](false, mockRecord, 'nonexistent movie', 'movie', '2023');
            expect(mockOmdbService.getFullEntryById).not.toHaveBeenCalled();
        }));
    });
});
