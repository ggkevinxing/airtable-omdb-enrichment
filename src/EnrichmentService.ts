import { isValidNumeric } from "@nerdware/ts-string-helpers";
import Airtable, { Table, FieldSet, Record, Attachment } from "airtable";
import { partition } from "lodash";
import {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_ID,
} from "./EnvSetup";
import { OmdbService } from "./omdb/OmdbService";
import { OmdbGetResponse } from "./omdb/OmdbModels";
import { isCoverUpToDate } from "./RecordUtil";

export class EnrichmentService {
  private table: Table<FieldSet>;
  constructor(
    private baseId = AIRTABLE_BASE_ID,
    private tableId = AIRTABLE_TABLE_ID,
    private omdbService = new OmdbService()
  ) {
    const airtable = new Airtable({
      apiKey: AIRTABLE_API_KEY,
    });
    const airtableBase = airtable.base(this.baseId);
    this.table = airtableBase(this.tableId);
  }

  public async enrichMetadata(): Promise<void> {
    const records = await this.table.select().all();
    const [recordsWithImdbId, recordsWithoutImdbId] = partition(
      records,
      (record) => record.get("imdb id")
    );

    /* TODO: for your purposes replace the update logic with whatever you want to retrieve and use, using the fields you want */

    // for records with imdb id, update with confidence
    for (const record of recordsWithImdbId) {
      await this.maybeUpdateRecordWithImdbId(record);
    }

    // for records without imdb id, update what we can with our best guess
    for (const record of recordsWithoutImdbId) {
      await this.maybeUpdateRecordWithTitle(record);
    }
  }

  private async maybeUpdateRecordWithImdbId(
    record: Record<FieldSet>
  ): Promise<void> {
    const imdbId = record.get("imdb id") as string;
    const recordId = record.get("id");
    const runtime = record.get("runtime (minutes)") as number | undefined;
    const releaseYear = record.get("release year") as string | undefined;

    if (isCoverUpToDate(record) && runtime && releaseYear) {
      console.log(`Skipping update for ${recordId}`);
      return;
    }

    const omdbEntry = await this.omdbService.getFullEntryById(imdbId);

    if (omdbEntry) {
      return this.updateRecordWithOmdbEntry(record, omdbEntry);
    }
  }

  private async updateRecordWithOmdbEntry(
    record: Record<FieldSet>,
    omdbEntry: OmdbGetResponse
  ): Promise<void> {
    const recordId = record.get("id");
    const imdbId = record.get("imdb id");
    const cover = record.get("cover") as Attachment[] | undefined;
    const runtime = record.get("runtime (minutes)") as number | undefined;
    const releaseYear = record.get("release year") as string | undefined;

    if (cover && cover.length > 0 && runtime && releaseYear) {
      console.log(`Skipping update for ${recordId}`);
      return;
    }

    const updateData: { [field: string]: any } = {}; // we have to use "any" because the type for Attachment updates is wrong

    if (!imdbId) {
      updateData["imdb id"] = omdbEntry.imdbID;
    }

    // only grab the cover if we don't have it and the reviews were unanimously great
    if (!isCoverUpToDate(record) && omdbEntry.Poster) {
      updateData["cover"] = [
        {
          url: omdbEntry.Poster, // passing a public url and nothing else as an Attachment becomes a newly uploaded Attachment
        },
      ];
    }

    if (!runtime && omdbEntry.Runtime) {
      const runtimeNum = this.omdbService.runtimeToNumber(omdbEntry.Runtime);
      if (isValidNumeric(runtimeNum)) {
        updateData["runtime (minutes)"] = runtimeNum;
      }
    }

    // shows can sometimes end and get an end year or be rebooted and become ongoing again
    if (
      (!releaseYear && omdbEntry.Year) ||
      (releaseYear && releaseYear != omdbEntry.Year)
    ) {
      updateData["release year"] = omdbEntry.Year;
    }

    if (Object.keys(updateData).length > 0) {
      console.log(
        `UPDATING ROW ${record.get("id")} (internal ID ${record.id})`
      );
      console.log(updateData);
      await record.updateFields(updateData, { typecast: true });
    } else {
      console.log(
        `Didn't end up updating, nothing to update ${record.get("id")} (internal ID ${record.id})`
      );
    }
  }

  private async maybeUpdateRecordWithTitle(
    record: Record<FieldSet>
  ): Promise<void> {
    // clean the title before searching on omdb
    let workingTitle = record.get("title") as string;

    const format = record.get("format"); // is one of "feature film", "television show", "documentary", "television special", "short film", "anthology film"
    let resultType: string | undefined = "movie"; // omdb format type either "movie", "series", "episode"

    let releaseYear = undefined;

    // if it's a TV show, we want to remove all "season" and fluff after the title of the show
    switch (format) {
      case "television show":
        const seasonRegex = /: (season)*(series)*(volume)* \d*.*/gi;
        workingTitle = workingTitle.replace(seasonRegex, "");
        resultType = "series";
        break;
      case "feature film":
        resultType = "movie";
      // for everything else, err on side of caution and don't filter out
      default:
        resultType = undefined;
        break;
    }

    // if there's a (<year>) in the title we want to remove it for the title but preserve that in our search as the release year
    const yearRegex = /\(\d{4}\)/i;
    const yearRegexResult = yearRegex.exec(workingTitle);
    if (yearRegexResult && yearRegexResult.length > 0) {
      releaseYear = yearRegexResult[0].replace("(", "").replace(")", "");
      workingTitle = workingTitle.replace(yearRegex, "");
    }

    // get rid of special characters that might throw the search off
    workingTitle = workingTitle.trim().toLowerCase();

    return this.maybeUpdateRecordWithWorkingTitle(
      false,
      record,
      workingTitle,
      resultType,
      releaseYear
    );
  }

  private async maybeUpdateRecordWithWorkingTitle(
    hasRetried: boolean,
    record: Record<FieldSet>,
    title: string,
    resultType?: string,
    releaseYear?: string
  ): Promise<void> {
    const searchResult = await this.omdbService.maybeGetEntry(
      title,
      resultType,
      releaseYear
    );

    if (searchResult && searchResult.length > 0) {
      // hopefully the search just turns up with one thing. hopefully.
      if (searchResult.length > 1) {
        console.log(
          `Search for ${resultType} ${title} is ambiguous, picking first one anyways`
        );
      }

      const searchEntry = searchResult[0];
      // convert to a full OmdbGetResponse and update row
      const omdbEntry = await this.omdbService.getFullEntryById(
        searchEntry.imdbID
      );
      if (omdbEntry) {
        return this.updateRecordWithOmdbEntry(record, omdbEntry);
      } else {
        console.log(
          `somehow, we failed even though we had a successful search. ${searchEntry}`
        );
      }
    } else {
      console.log(
        `Search couldn't find ${resultType} ${title} and release year ${releaseYear}`
      );
      if (!hasRetried) {
        // remove non-alphanumeric and non-hyphen (sometimes useful in titles) from title
        const newWorkingTitle = title
          .replace(/[^a-zA-Z0-9]/g, " ")
          .replace(/\s{2,}/g, " ");
        console.log(`retrying with ${newWorkingTitle} instead of ${title}`);
        if (newWorkingTitle != title)
          return this.maybeUpdateRecordWithWorkingTitle(
            true,
            record,
            newWorkingTitle,
            resultType,
            releaseYear
          );
      }
    }
  }
}
