import { config } from "dotenv";

config();

export const AIRTABLE_API_KEY = process.env["AIRTABLE_API_KEY"] as string; // AirTable Personal Access Token (PAT) API key
export const AIRTABLE_BASE_ID = process.env["AIRTABLE_BASE_ID"] as string;
export const AIRTABLE_TABLE_ID = process.env["AIRTABLE_TABLE_ID"] as string;
export const OMDB_API_KEY = process.env["OMDB_API_KEY"] as string; // OpenMovieDatabase API Key

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID || !OMDB_API_KEY) throw new Error("Environment not configured correctly");

