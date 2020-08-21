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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var Apify = require("apify");
var readline = require("readline");
var fs = require("fs");
var os = require("os");
var log = Apify.utils.log;
process.setMaxListeners(Infinity);
log.setLevel(log.LEVELS.OFF);
var lines = [];
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', function (line) {
    lines.push(line);
}).on('close', function () { return __awaiter(void 0, void 0, void 0, function () {
    var scope, requestQueue, sources;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                scope = lines.map(function (line) { return line + '[.*]'; });
                return [4 /*yield*/, Apify.openRequestQueue()];
            case 1:
                requestQueue = _a.sent();
                sources = lines.map(function (line) {
                    return {
                        url: line,
                        userData: {
                            baseUrl: line,
                            label: 'START'
                        }
                    };
                });
                Apify.main(function () { return __awaiter(void 0, void 0, void 0, function () {
                    var rl, handlePageFunction, crawler;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                rl = new Apify.RequestList({
                                    sources: sources,
                                    persistRequestsKey: null,
                                    keepDuplicateUrls: false
                                });
                                return [4 /*yield*/, rl.initialize()];
                            case 1:
                                _a.sent();
                                handlePageFunction = function (_a) {
                                    var request = _a.request, page = _a.page;
                                    return __awaiter(void 0, void 0, void 0, function () {
                                        var parsedUrl, combinedParsedUrl, links;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    parsedUrl = new URL(request.userData.baseUrl);
                                                    combinedParsedUrl = parsedUrl.protocol + '//' + parsedUrl.host;
                                                    console.log(request.url);
                                                    return [4 /*yield*/, getParameters(page)];
                                                case 1:
                                                    (_b.sent()).forEach(function (param) {
                                                        writeParameterToFile(param);
                                                    });
                                                    if (!(request.userData.label === 'START')) return [3 /*break*/, 3];
                                                    return [4 /*yield*/, Apify.utils.enqueueLinks({
                                                            page: page,
                                                            selector: 'a',
                                                            requestQueue: requestQueue,
                                                            pseudoUrls: scope,
                                                            limit: 20,
                                                            transformRequestFunction: function (requestToTransform) {
                                                                // @ts-ignore
                                                                requestToTransform.userData.label = 'SECONDARY';
                                                                // @ts-ignore
                                                                requestToTransform.userData.baseUrl = request.url;
                                                                return requestToTransform;
                                                            }
                                                        })];
                                                case 2:
                                                    _b.sent();
                                                    return [3 /*break*/, 5];
                                                case 3:
                                                    if (!(request.userData.label === 'SECONDARY')) return [3 /*break*/, 5];
                                                    return [4 /*yield*/, page.$$eval('a', function (as) { return as.map(function (a) { return a.href; }); })];
                                                case 4:
                                                    links = _b.sent();
                                                    links.forEach(function (url) {
                                                        if (url.startsWith(combinedParsedUrl)) {
                                                            console.log(url);
                                                        }
                                                    });
                                                    _b.label = 5;
                                                case 5: return [2 /*return*/];
                                            }
                                        });
                                    });
                                };
                                crawler = new Apify.PuppeteerCrawler({
                                    requestList: rl,
                                    requestQueue: requestQueue,
                                    handlePageFunction: handlePageFunction,
                                    launchPuppeteerOptions: {
                                        useChrome: true,
                                        //@ts-ignore, option is valid, but not defined
                                        headless: true,
                                        // @ts-ignore
                                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                                        // @ts-ignore
                                        ignoreHTTPSErrors: true
                                    },
                                    handleFailedRequestFunction: function () { },
                                    maxConcurrency: 10,
                                    handlePageTimeoutSecs: 5,
                                    gotoTimeoutSecs: 5
                                });
                                return [4 /*yield*/, crawler.run()];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
        }
    });
}); });
var getParameters = function (page) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.evaluate(function () {
                    var parameters = [];
                    var setObjects = [];
                    for (var key in window) {
                        var value = window[key];
                        if (value instanceof Set) {
                            setObjects.push(value);
                        }
                    }
                    setObjects.forEach(function (set) { return set.forEach(function (value) { return parameters.push(value); }); });
                    return parameters;
                })];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var writeParameterToFile = function (value) { return __awaiter(void 0, void 0, void 0, function () {
    var writePath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (value.length > 15)
                    return [2 /*return*/];
                if (/[a-zA-Z0-9_\-\.]+/.test(value))
                    return [2 /*return*/];
                writePath = './data/parameters';
                return [4 /*yield*/, fs.writeFile(writePath, null, { flag: 'wx' }, function (err) {
                        if (err)
                            return;
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, fs.readFile(writePath, 'utf8', function (err, data) {
                        var regexString = "^" + value + "$";
                        var re = new RegExp(regexString, 'g');
                        if (err)
                            return;
                        if (re.test(data))
                            return;
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, fs.open(writePath, 'a', 666, function (e, id) {
                        fs.write(id, value + os.EOL, null, 'utf8', function () {
                            fs.close(id, null);
                        });
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
