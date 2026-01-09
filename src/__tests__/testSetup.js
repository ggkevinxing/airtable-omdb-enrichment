"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("jest");
// Global test configuration
jest.setTimeout(10000);
// Mock console methods to reduce test noise
global.console = Object.assign(Object.assign({}, console), { log: jest.fn(), warn: jest.fn(), error: jest.fn() });
