"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMDB_API_KEY = exports.AIRTABLE_TABLE_ID = exports.AIRTABLE_BASE_ID = exports.AIRTABLE_API_KEY = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
exports.AIRTABLE_API_KEY = process.env['AIRTABLE_API_KEY']; // AirTable Personal Access Token (PAT) API key
exports.AIRTABLE_BASE_ID = process.env['AIRTABLE_BASE_ID'];
exports.AIRTABLE_TABLE_ID = process.env['AIRTABLE_TABLE_ID'];
exports.OMDB_API_KEY = process.env['OMDB_API_KEY']; // OpenMovieDatabase API Key
if (!exports.AIRTABLE_API_KEY ||
    !exports.AIRTABLE_BASE_ID ||
    !exports.AIRTABLE_TABLE_ID ||
    !exports.OMDB_API_KEY)
    throw new Error('Environment not configured correctly');
