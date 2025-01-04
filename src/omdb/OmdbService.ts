import { OmdbClient } from "./OmdbClient";
import { OmdbGetResponse, OmdbSearchResult } from "./OmdbModels";

export class OmdbService {
  constructor(private omdbClient = new OmdbClient()) {}

  public async getFullEntryById(
    imdbId: string
  ): Promise<OmdbGetResponse | undefined> {
    const getResult = await this.omdbClient.get(imdbId);
    return getResult.Response === "True" ? getResult : undefined;
  }

  public async maybeGetEntry(
    title: string,
    resultType?: string,
    releaseYear?: string
  ): Promise<OmdbSearchResult[] | undefined> {
    const searchResult = await this.omdbClient.search(
      title,
      resultType,
      releaseYear
    );
    return searchResult.Search ? searchResult.Search : undefined;
  }

  // runtime strings are in the form of "X min", e.g. "90 min"
  public runtimeToNumber(runtime: string): number {
    const [numString, _] = runtime.split(" ");
    return Number(numString);
  }
}
