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
exports.OmdbClient = void 0;
const axios_1 = __importDefault(require("axios"));
const EnvSetup_1 = require("../EnvSetup");
const OMDB_BASE_URL = 'https://www.omdbapi.com/';
class OmdbClient {
    constructor(baseURL = OMDB_BASE_URL, apiKey = EnvSetup_1.OMDB_API_KEY) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.axios = axios_1.default.create({
            baseURL: this.baseURL,
        });
    }
    search(title, resultType, releaseYear) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                apiKey: this.apiKey,
                s: title,
                type: resultType,
                y: releaseYear,
            };
            // not sure if this needs to be done but just to be safe
            if (!resultType)
                delete params.type;
            if (!releaseYear)
                delete params.y;
            return this.axios
                .request({
                method: 'GET',
                params,
            })
                .then((res) => res.data);
        });
    }
    // there is get by title, but if the title is too mismatching it won't find it. we will instead always search by imdb ID and retrieve that through search requests
    get(imdbId) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                apiKey: this.apiKey,
                i: imdbId,
            };
            return this.axios
                .request({
                method: 'GET',
                params,
            })
                .then((res) => res.data);
        });
    }
}
exports.OmdbClient = OmdbClient;
