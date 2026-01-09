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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentService = void 0;
const ts_string_helpers_1 = require("@nerdware/ts-string-helpers");
const airtable_1 = __importDefault(require("airtable"));
const lodash_1 = require("lodash");
const EnvSetup_1 = require("./EnvSetup");
const OmdbService_1 = require("./omdb/OmdbService");
const RecordUtil_1 = require("./RecordUtil");
class EnrichmentService {
    constructor(baseId = EnvSetup_1.AIRTABLE_BASE_ID, tableId = EnvSetup_1.AIRTABLE_TABLE_ID, omdbService = new OmdbService_1.OmdbService()) {
        this.baseId = baseId;
        this.tableId = tableId;
        this.omdbService = omdbService;
        const airtable = new airtable_1.default({
            apiKey: EnvSetup_1.AIRTABLE_API_KEY,
        });
        const airtableBase = airtable.base(this.baseId);
        this.table = airtableBase(this.tableId);
    }
    enrichMetadata() {
        return __awaiter(this, void 0, void 0, function* () {
            const records = yield this.table.select().all();
            const [recordsWithImdbId, recordsWithoutImdbId] = (0, lodash_1.partition)(records, (record) => record.get('imdb id'));
            /* TODO: for your purposes replace the update logic with whatever you want to retrieve and use, using the fields you want */
            // for records with imdb id, update with confidence
            for (const record of recordsWithImdbId) {
                yield this.maybeUpdateRecordWithImdbId(record);
            }
            // for records without imdb id, update what we can with our best guess
            for (const record of recordsWithoutImdbId) {
                yield this.maybeUpdateRecordWithTitle(record);
            }
        });
    }
    maybeUpdateRecordWithImdbId(record) {
        return __awaiter(this, void 0, void 0, function* () {
            const imdbId = record.get('imdb id');
            const recordId = record.get('id');
            const runtime = record.get('runtime (minutes)');
            const releaseYear = record.get('release year');
            if ((0, RecordUtil_1.isCoverUpToDate)(record) && runtime && releaseYear) {
                console.log(`Skipping update for ${recordId}`);
                return;
            }
            const omdbEntry = yield this.omdbService.getFullEntryById(imdbId);
            if (omdbEntry) {
                return this.updateRecordWithOmdbEntry(record, omdbEntry);
            }
        });
    }
    updateRecordWithOmdbEntry(record, omdbEntry) {
        return __awaiter(this, void 0, void 0, function* () {
            const recordId = record.get('id');
            const imdbId = record.get('imdb id');
            const cover = record.get('cover');
            const runtime = record.get('runtime (minutes)');
            const releaseYear = record.get('release year');
            if (cover && cover.length > 0 && runtime && releaseYear) {
                console.log(`Skipping update for ${recordId}`);
                return;
            }
            const updateData = {}; // we have to use "any" because the type for Attachment updates is wrong
            if (!imdbId) {
                updateData['imdb id'] = omdbEntry.imdbID;
            }
            // only grab the cover if we don't have it and the reviews were unanimously great
            if (!(0, RecordUtil_1.isCoverUpToDate)(record) && omdbEntry.Poster) {
                updateData['cover'] = [
                    {
                        url: omdbEntry.Poster, // passing a public url and nothing else as an Attachment becomes a newly uploaded Attachment
                    },
                ];
            }
            if (!runtime && omdbEntry.Runtime) {
                const runtimeNum = this.omdbService.runtimeToNumber(omdbEntry.Runtime);
                if ((0, ts_string_helpers_1.isValidNumeric)(runtimeNum)) {
                    updateData['runtime (minutes)'] = runtimeNum;
                }
            }
            // shows can sometimes end and get an end year or be rebooted and become ongoing again
            if ((!releaseYear && omdbEntry.Year) ||
                (releaseYear && releaseYear != omdbEntry.Year)) {
                updateData['release year'] = omdbEntry.Year;
            }
            if (Object.keys(updateData).length > 0) {
                console.log(`UPDATING ROW ${record.get('id')} (internal ID ${record.id})`);
                console.log(updateData);
                yield record.updateFields(updateData, { typecast: true });
            }
            else {
                console.log(`Didn't end up updating, nothing to update ${record.get('id')} (internal ID ${record.id})`);
            }
        });
    }
    maybeUpdateRecordWithTitle(record) {
        return __awaiter(this, void 0, void 0, function* () {
            // clean the title before searching on omdb
            let workingTitle = record.get('title');
            const format = record.get('format'); // is one of "feature film", "television show", "documentary", "television special", "short film", "anthology film"
            let resultType = 'movie'; // omdb format type either "movie", "series", "episode"
            let releaseYear = undefined;
            // if it's a TV show, we want to remove all "season" and fluff after the title of the show
            switch (format) {
                case 'television show':
                    const seasonRegex = /: (season)*(series)*(volume)* \d*.*/gi;
                    workingTitle = workingTitle.replace(seasonRegex, '');
                    resultType = 'series';
                    break;
                case 'feature film':
                    resultType = 'movie';
                    break;
                // for everything else, err on side of caution and don't filter out
                default:
                    resultType = undefined;
                    break;
            }
            // if there's a (<year>) in the title we want to remove it for the title but preserve that in our search as the release year
            const yearRegex = /\(\d{4}\)/i;
            const yearRegexResult = yearRegex.exec(workingTitle);
            if (yearRegexResult && yearRegexResult.length > 0) {
                releaseYear = yearRegexResult[0].replace('(', '').replace(')', '');
                workingTitle = workingTitle.replace(yearRegex, '');
            }
            // get rid of special characters that might throw the search off
            workingTitle = workingTitle.trim().toLowerCase();
            return this.maybeUpdateRecordWithWorkingTitle(false, record, workingTitle, resultType, releaseYear);
        });
    }
    maybeUpdateRecordWithWorkingTitle(hasRetried, record, title, resultType, releaseYear) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchResult = yield this.omdbService.maybeGetEntry(title, resultType, releaseYear);
            if (searchResult && searchResult.length > 0) {
                // hopefully the search just turns up with one thing. hopefully.
                if (searchResult.length > 1) {
                    console.log(`Search for ${resultType} ${title} is ambiguous, picking first one anyways`);
                }
                const searchEntry = searchResult[0];
                // convert to a full OmdbGetResponse and update row
                const omdbEntry = yield this.omdbService.getFullEntryById(searchEntry.imdbID);
                if (omdbEntry) {
                    return this.updateRecordWithOmdbEntry(record, omdbEntry);
                }
                else {
                    console.log(`somehow, we failed even though we had a successful search. ${searchEntry}`);
                }
            }
            else {
                console.log(`Search couldn't find ${resultType} ${title} and release year ${releaseYear}`);
                if (!hasRetried) {
                    // remove non-alphanumeric and non-hyphen (sometimes useful in titles) from title
                    const newWorkingTitle = title
                        .replace(/[^a-zA-Z0-9]/g, ' ')
                        .replace(/\s{2,}/g, ' ');
                    console.log(`retrying with ${newWorkingTitle} instead of ${title}`);
                    if (newWorkingTitle != title)
                        return this.maybeUpdateRecordWithWorkingTitle(true, record, newWorkingTitle, resultType, releaseYear);
                }
            }
        });
    }
}
exports.EnrichmentService = EnrichmentService;
