import * as Apify from 'apify'
import { Logger } from './utils/logger';
import { DOMXSSScanner } from './scanner/DOMXSSScanner';
import { PuppeteerHandlePage, RequestQueue, PseudoUrl } from 'apify';
import { Page } from 'puppeteer';
import path = require('path');

const { log } = Apify.utils;

process.setMaxListeners(Infinity);
process.stdin.setEncoding('utf-8');
log.setLevel(log.LEVELS.OFF);

const logger = new Logger();
const sources: any = [];

let text = '';

process.stdin.on('data', (data) => {
    if (data) {
        text += data;

        const lines = text.split("\n");
        lines.forEach(line => {
            if (line) {
                sources.push({
                    url: line,
                    userData: {
                        baseUrl: line,
                        label: 'START'
                    }
                });
            }
        });
    }
});

process.stdin.on('end', async () => {
    const requestQueue = await Apify.openRequestQueue();

    Apify.main(async () => {
        const rl = new Apify.RequestList({
            sources,
            persistRequestsKey: null,
            keepDuplicateUrls: false
        });

        await rl.initialize();

        const handlePageFunction: PuppeteerHandlePage = async ({ request, page, response }) => {
            const parsedUrl: URL | null = request?.userData?.baseUrl ? new URL(request.userData.baseUrl) : null;
            const combinedParsedUrl = parsedUrl ? parsedUrl.protocol + '//' + parsedUrl.host : '';
            const domXssScanner = new DOMXSSScanner(requestQueue);
            const scope = [request.userData.baseUrl + '[.*]'];

            if (request.userData.label === 'START') {
                await Apify.utils.puppeteer.blockRequests(page, {
                    extraUrlPatterns: ['adsbygoogle.js', 'woff2']
                });

                await logXhrRequests(page, combinedParsedUrl);

                await page.waitFor(500);

                await enqueueUrlWithInputGETParameters(request.url, page, requestQueue, combinedParsedUrl);
                getUrlParameters(request.url);
                await domXssScanner.scan(request.url);
                await domXssScanner.scanAngularJS(page);
                await domXssScanner.scanPOSTListener(page, logger);
                await logS3Urls(page);

                await Apify.utils.enqueueLinks({
                    page,
                    selector: 'a',
                    requestQueue,
                    pseudoUrls: scope,
                    limit: 20,
                    transformRequestFunction: (requestToTransform) => {
                        // @ts-ignore
                        requestToTransform.userData.baseUrl = request.url;
                        return requestToTransform;
                    }
                });


            } else if (request.userData.label === 'SCAN') {
                await domXssScanner.checkResponse(page, request, logger);
            } else if (response.headers()['content-type'].includes('text/html')) {
                logger.logUrl(request.url);
                await logXhrRequests(page, combinedParsedUrl);

                await page.waitFor(500);
                //@ts-ignore
                const links = await page.$$eval('a', as => as.map(a => a.href));

                await domXssScanner.scan(request.url);
                await enqueueUrlWithInputGETParameters(request.url, page, requestQueue, combinedParsedUrl);
                await logS3Urls(page);
                await domXssScanner.scanAngularJS(page);
                await domXssScanner.scanPOSTListener(page, logger);

                for (const link of links) {
                    if (combinedParsedUrl && link.startsWith(combinedParsedUrl)) {
                        logger.logUrl(link);
                        getUrlParameters(link);
                        await domXssScanner.scan(link);
                    }
                }
            }

            let poisoned = await page.evaluate(() => {
                //@ts-ignore
                if (typeof window.XSSPoisoned !== 'undefined' && window.XSSPoisoned) {
                    return true;
                }
                return false;
            });

            if (poisoned) {
                logger.logExperimentalDOMPoisoningXSS(page.url())
            }
        };

        const gotoFunction = async ({ page, request }) => {
            await page.evaluateOnNewDocument(() => {
                // override document.write to check for poisoned sink
                const poisonStrings = [
                    '\'" <img data-wrt',
                    '\'"+<img+data-wrt',
                    '\'"%20<img%20data-wrt'];

                (function () {
                    var old = document.write;
                    
                    document.write = function (content) {
                        if (content.includes(poisonStrings[0]) 
                            || content.includes(poisonStrings[1])
                            || content.includes(poisonStrings[2])) {
                            //@ts-ignore
                            window.XSSPoisoned = true;
                        }
                        old.call(document, content);
                    };
                })();

                // override document.write to check for poisoned sink
                (function () {
                    var old = document.writeln;

                    document.writeln = function (content) {
                        if (content.includes(poisonStrings[0]) 
                            || content.includes(poisonStrings[1])
                            || content.includes(poisonStrings[2])) {
                                //@ts-ignore
                                window.XSSPoisoned = true;
                        }
                        old.call(document, content);
                    };
                })();

                //@ts-ignore
                if (typeof jQuery !== 'undefined') {
                    (function ($) {
                        var oldHtml = $.fn.html;
                        $.fn.html = function (content) {
                            if (content.includes(poisonStrings[0]) 
                                || content.includes(poisonStrings[1])
                                || content.includes(poisonStrings[2])) {
                                //@ts-ignore
                                window.XSSPoisoned = true;
                            }
                            oldHtml($, content);
                        };
                        //@ts-ignore
                    })(jQuery);
                }
            });
            return await page.goto(request.url, { waitUntil: ["domcontentloaded"], timeout: 10000 });;
        }

        // Create a PuppeteerCrawler
        const crawler = new Apify.PuppeteerCrawler({
            requestList: rl,
            requestQueue,
            handlePageFunction,
            gotoFunction,
            launchPuppeteerOptions: {
                //@ts-ignore, option is valid, but not defined
                headless: true,
                // @ts-ignore
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                // @ts-ignore
                ignoreHTTPSErrors: true,
            },
            handleFailedRequestFunction: () => { },
            maxConcurrency: 25,
            useSessionPool: true
        });

        await crawler.run();
    });
});

const getParameters = async (page) => {
    return await page.evaluate(() => {
        let parameters: Array<string> = [];

        let setObjects: Array<Set<string>> = [];

        for (let key in window) {
            let value = window[key];
            if (value instanceof Set) {
                setObjects.push(value);
            }
        }

        //setObjects.forEach(set => set.forEach(value => logger.logParameter(value)));

        return parameters;
    });
}

const getUrlParameters = (url: string) => {
    const parsedPageUrl = new URL(url);
    for (const param of parsedPageUrl.searchParams.keys()) {
        if (!/\b[a-zA-Z0-9_\-\[\]]+\b/.test(param)) return;
        logger.logParameter(param);
    }
}

const enqueueUrlWithInputGETParameters = async (url: string, page: Page, requestQueue: RequestQueue, baseUrl: string) => {
    const parsedPageUrl = new URL(url);
    const inputsNames = await page.$$eval('input', els => els.filter(el => el.getAttribute('name')).map(el => el.getAttribute('name')));

    for (const name of inputsNames) {
        if (!parsedPageUrl.searchParams.has(name)) {
            parsedPageUrl.searchParams.append(name, '1');
        }
    }

    await requestQueue.addRequest({
        url: parsedPageUrl.href,
        userData: {
            baseUrl
        }
    });
}

const logXhrRequests = async (page: Page, scopeUrl: string) => {
    await page.setRequestInterception(true);

    page.on('request', request => request.url().startsWith(scopeUrl) && logger.logUrl(request.url()));
}

const logS3Urls = async (page: Page) => {
    const scriptTags = await page.evaluate(
        () => [...document.querySelectorAll('script')].map(elem => elem.src || '')
    );

    for (const tag of scriptTags) {
        if (tag.includes('amazonaws.com')) {
            var result = /(?<=\/\/s3(\.[a-z0-9\-]+)?\.amazonaws\.com\/)([^/]+)(?=\/)|(?<=\/\/)[a-z0-9\-]+(?=\.s3\.amazonaws\.com)/.exec(tag);
            logger.logS3Url(page.url(), result[0]);
        }
    }

    const imgTags = await page.evaluate(
        () => [...document.querySelectorAll('img')].map(elem => elem.src || '')
    );

    for (const tag in imgTags) {
        if (tag && tag.includes('amazonaws.com')) {
            var result = /(?<=\/\/s3(\.[a-z0-9\-]+)?\.amazonaws\.com\/)([^/]+)(?=\/)|(?<=\/\/)[a-z0-9\-]+(?=\.s3\.amazonaws\.com)/.exec(tag);
            logger.logS3Url(page.url(), result[0]);
        }
    }
}