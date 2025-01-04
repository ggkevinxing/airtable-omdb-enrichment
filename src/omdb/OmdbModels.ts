type ResultType = "movie" | "series" | "episode";

export interface OmdbSearchResult {
  Title: string;
  Year?: string; // string number
  imdbID: string;
  Type: ResultType;
  Poster?: string; // URL to an image
}

interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbGetResponse extends OmdbSearchResult {
  Rated?: string;
  Released?: string; // string date like "17 Dec 2022"
  Runtime?: string; // string number and the unit like "90 min"
  Genre?: string; // multiple genres split by commas like "Comedy, Drama, Animation"
  Director?: string; // similar to genre, split by commas
  Writer?: string; // split by commas
  Actors?: string; // split by commas
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Ratings?: OmdbRating[];
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  DVD?: string;
  BoxOffice?: string;
  Website?: string;
  Response: string; // string boolean
  Error?: string;
}

export interface OmdbSearchResponse {
  Search?: OmdbSearchResult[];
  totalResults: string; // string number
  Response: string; // string boolean
  Error?: string;
}
