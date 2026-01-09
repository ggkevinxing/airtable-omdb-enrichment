"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockRecord = createMockRecord;
function createMockRecord(options = {}) {
    const { id = 'rec123', fields = {}, hasImdbId = false, hasCover = false, hasRuntime = false, hasReleaseYear = false, reviews = { kev: '👍', net: '👍' }, format = 'feature film', title = 'Test Movie', } = options;
    const mockFields = Object.assign({ id: id, title: title, format: format, 'kev review': reviews.kev, 'net review': reviews.net }, fields);
    if (hasImdbId) {
        mockFields['imdb id'] = 'tt1234567';
    }
    if (hasCover) {
        mockFields['cover'] = [
            {
                id: 'att123',
                url: 'https://example.com/existing-cover.jpg',
                filename: 'cover.jpg',
            },
        ];
    }
    if (hasRuntime) {
        mockFields['runtime (minutes)'] = 120;
    }
    if (hasReleaseYear) {
        mockFields['release year'] = '2023';
    }
    const mockRecord = {
        id: id,
        get: jest.fn((field) => mockFields[field]),
        updateFields: jest.fn().mockResolvedValue(undefined),
        fields: mockFields,
    };
    return mockRecord;
}
