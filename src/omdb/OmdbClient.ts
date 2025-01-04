import axios, { AxiosInstance } from "axios";
import { OMDB_API_KEY } from "../EnvSetup";
import { OmdbGetResponse, OmdbSearchResponse } from "./OmdbModels";

const OMDB_BASE_URL = "https://www.omdbapi.com/";

export class OmdbClient {
  protected axios: AxiosInstance;

  constructor(
    private baseURL = OMDB_BASE_URL,
    private apiKey = OMDB_API_KEY
  ) {
    this.axios = axios.create({
      baseURL: this.baseURL,
    });
  }

  public async search(
    title: string,
    resultType?: string,
    releaseYear?: string
  ): Promise<OmdbSearchResponse> {
    const params = {
      apiKey: this.apiKey,
      s: title,
      type: resultType,
      y: releaseYear,
    };
    // not sure if this needs to be done but just to be safe
    if (!resultType) delete params.type;
    if (!releaseYear) delete params.y;

    return this.axios
      .request({
        method: "GET",
        params,
      })
      .then((res) => res.data);
  }

  // there is get by title, but if the title is too mismatching it won't find it. we will instead always search by imdb ID and retrieve that through search requests
  public async get(imdbId: string): Promise<OmdbGetResponse> {
    const params = {
      apiKey: this.apiKey,
      i: imdbId,
    };

    return this.axios
      .request({
        method: "GET",
        params,
      })
      .then((res) => res.data);
  }
}
