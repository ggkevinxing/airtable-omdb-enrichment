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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmdbService = void 0;
const OmdbClient_1 = require("./OmdbClient");
class OmdbService {
    constructor(omdbClient = new OmdbClient_1.OmdbClient()) {
        this.omdbClient = omdbClient;
    }
    getFullEntryById(imdbId) {
        return __awaiter(this, void 0, void 0, function* () {
            const getResult = yield this.omdbClient.get(imdbId);
            return getResult.Response === 'True' ? getResult : undefined;
        });
    }
    maybeGetEntry(title, resultType, releaseYear) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchResult = yield this.omdbClient.search(title, resultType, releaseYear);
            return searchResult.Search ? searchResult.Search : undefined;
        });
    }
    // runtime strings are in the form of "X min", e.g. "90 min"
    runtimeToNumber(runtime) {
        const [numString, _] = runtime.split(' ');
        return Number(numString);
    }
}
exports.OmdbService = OmdbService;
