import { sanitizeAlphanumericWithSpaces } from "@nerdware/ts-string-helpers";
import Airtable, { Table, FieldSet, Record, Attachment } from "airtable";
import { partition } from "lodash";
import { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID } from "./EnvSetup";
import { OmdbService } from "./omdb/OmdbService";
import { OmdbGetResponse } from "./omdb/OmdbModels";
import { isCoverUpToDate } from "./RecordUtil";

export class EnrichmentService {
    private table: Table<FieldSet>;
    constructor(
        private baseId = AIRTABLE_BASE_ID,
        private tableId = AIRTABLE_TABLE_ID,
        private omdbService = new OmdbService()
    ){
        const airtable = new Airtable({
            apiKey: AIRTABLE_API_KEY
        });
        const airtableBase = airtable.base(this.baseId);
        this.table = airtableBase(this.tableId);
    }

    public async enrichMetadata(): Promise<void> {
        const records = await this.table.select().all();
        const [ recordsWithImdbId, recordsWithoutImdbId ] = partition(records, (record) => record.get("imdb id"));

        /* TODO: for your purposes replace the update logic with whatever you want to retrieve and use, using the fields you want */

        // for records with imdb id, update with confidence
        for (const record of recordsWithImdbId) {
            await this.updateRecordWithImdbId(record);
        }
        
        // for records without imdb id, update what we can with our best guess
        for (const record of recordsWithoutImdbId) {
            await this.maybeUpdateRecordWithTitle(record);
        }
    }

    private async updateRecordWithImdbId(record: Record<FieldSet>): Promise<void> {
        const imdbId = record.get("imdb id") as string;
        const recordId = record.get("id");
        const runtime = record.get("runtime (minutes)") as number | undefined;
        const releaseYear = record.get("release year") as string | undefined;

        if (isCoverUpToDate(record) && runtime && releaseYear) {
            console.log(`Skipping update for ${recordId}`)
            return;
        }

        const omdbEntry = await this.omdbService.getFullEntryById(imdbId);

        if (omdbEntry) {
            return this.updateRecordWithOmdbEntry(record, omdbEntry);
        }
    }

    private async updateRecordWithOmdbEntry(record: Record<FieldSet>, omdbEntry: OmdbGetResponse): Promise<void> {
        const recordId = record.get("id");
        const imdbId = record.get("imdb id");
        const cover = record.get("cover") as Attachment[] | undefined;
        const runtime = record.get("runtime (minutes)") as number | undefined;
        const releaseYear = record.get("release year") as string | undefined;

        if ((cover && cover.length > 0) && runtime && releaseYear) {
            console.log(`Skipping update for ${recordId}`)
            return;
        }

        const updateData: { [field: string]: any } = {}; // we have to use "any" because the type for Attachment updates is wrong

        if (!imdbId) {
            updateData["imdb id"] = omdbEntry.imdbID;
        }

        // only grab the cover if we don't have it and the reviews were unanimously great
        if (!isCoverUpToDate(record) && omdbEntry.Poster) {
            updateData["cover"] = [{
                url: omdbEntry.Poster // passing a public url and nothing else as an Attachment becomes a newly uploaded Attachment
            }]
        }

        if (!runtime && omdbEntry.Runtime) {
            const runtimeNum = this.omdbService.runtimeToNumber(omdbEntry.Runtime);
            updateData["runtime (minutes)"] = runtimeNum;
        }

        // shows can sometimes end and get an end year or be rebooted and become ongoing again
        if (!releaseYear && omdbEntry.Year || (releaseYear && releaseYear != omdbEntry.Year)) {
            updateData["release year"] = omdbEntry.Year;
        }

        if (Object.keys(updateData).length > 0) {
            console.log(`UPDATING ROW ${record.get("id")} (internal ID ${record.id})`);
            console.log(updateData);
            await record.updateFields(updateData, { typecast: true });
        }
        else {
            console.log(`Didn't end up updating, nothing to update ${record.get("id")} (internal ID ${record.id})`);
        }
    }

    private async maybeUpdateRecordWithTitle(record: Record<FieldSet>): Promise<void> {
        // clean the title before searching on omdb
        let workingTitle = record.get("title") as string;

        const format = record.get("format"); // is one of "feature film", "television show", "documentary", "television special", "short film", "anthology film"
        let resultType = "movie"; // omdb format type either "movie", "series", "episode"

        let releaseYear = undefined;

        // if it's a TV show, we want to remove all "season" and fluff after the title of the show
        if (format == "television show") {
            const seasonRegex = /: (season)*(series)*(volume)* \d*.*/gi;
            workingTitle = workingTitle.replace(seasonRegex, "");
            resultType = "series";
        }

        // if there's a (<year>) in the title we want to remove it for the title but preserve that in our search as the release year
        const yearRegex = /\(\d{4}\)/i;
        const yearRegexResult = yearRegex.exec(workingTitle);
        if (yearRegexResult && yearRegexResult.length > 0) {
            releaseYear = yearRegexResult[0].replace("(","").replace(")","");
            workingTitle = workingTitle.replace(yearRegex, "");
        }

        // get rid of special characters that might throw the search off
        workingTitle = sanitizeAlphanumericWithSpaces(workingTitle).trim().toLowerCase();

        const searchResult = await this.omdbService.maybeGetEntry(workingTitle, resultType, releaseYear);

        if (searchResult && searchResult.length > 0) {
            // hopefully the search just turns up with one thing. hopefully.
            if (searchResult.length > 1) {
                console.log(`Search for ${resultType} ${workingTitle} is ambiguous, picking first one anyways`);
            }

            const searchEntry = searchResult[0];
            // convert to a full OmdbGetResponse and update row
            const omdbEntry = await this.omdbService.getFullEntryById(searchEntry.imdbID);
            if (omdbEntry) {
                return this.updateRecordWithOmdbEntry(record, omdbEntry);
            }
            else {
                console.log(`somehow, we failed even though we had a successful search. ${searchEntry}`);
            }
        }
        else {
            console.log(`Search couldn't find ${resultType} ${workingTitle} and release year ${releaseYear}`);
        }
    }

    
}