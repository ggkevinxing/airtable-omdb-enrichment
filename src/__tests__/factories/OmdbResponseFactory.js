"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockOmdbGetResponse = createMockOmdbGetResponse;
exports.createMockOmdbSearchResult = createMockOmdbSearchResult;
exports.createMockOmdbSearchResponse = createMockOmdbSearchResponse;
function createMockOmdbGetResponse(options = {}) {
    const { imdbId = 'tt1234567', title = 'Test Movie', year = '2023', runtime = '120 min', poster = 'https://example.com/poster.jpg', type = 'movie', response = 'True', error, } = options;
    return {
        imdbID: imdbId,
        Title: title,
        Year: year,
        Runtime: runtime,
        Poster: poster,
        Type: type,
        Response: response,
        Error: error,
        Rated: 'PG-13',
        Released: '01 Jan 2023',
        Genre: 'Action, Adventure',
        Director: 'Test Director',
        Writer: 'Test Writer',
        Actors: 'Test Actor',
        Plot: 'Test plot description',
        Language: 'English',
        Country: 'USA',
        Awards: 'Test Awards',
        Metascore: '75',
        imdbRating: '7.5',
        imdbVotes: '1,000',
        DVD: '01 Jan 2023',
        BoxOffice: '$100,000,000',
        Website: 'https://example.com',
    };
}
function createMockOmdbSearchResult(options = {}) {
    const { imdbId = 'tt1234567', title = 'Test Movie', year = '2023', poster = 'https://example.com/poster.jpg', type = 'movie', } = options;
    return {
        imdbID: imdbId,
        Title: title,
        Year: year,
        Poster: poster,
        Type: type,
    };
}
function createMockOmdbSearchResponse(results, totalResults = results.length.toString()) {
    return {
        Search: results,
        totalResults: totalResults,
        Response: 'True',
    };
}
