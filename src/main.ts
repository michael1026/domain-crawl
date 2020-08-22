import * as Apify from 'apify'
import * as readline from 'readline';
import { Logger } from './utils/logger';
import { DOMXSSScanner } from './scanner/DOMXSSScanner';
import { PuppeteerHandlePage, RequestQueue } from 'apify';
import { Page } from 'puppeteer';

const { log } = Apify.utils;

process.setMaxListeners(Infinity);
//log.setLevel(log.LEVELS.OFF);

const lines = [];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
const logger = new Logger();

rl.on('line', (line) => {
    lines.push(line);
}).on('close', async () => {
    const scope = lines.map(line => line + '[.*]');
    const requestQueue = await Apify.openRequestQueue();
    const sources = lines.map(line => {
        return {
            url: line,
            userData: {
                baseUrl: line,
                label: 'START'
            }
        }
    });

    lines.length = 0;
    

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

            if (request.userData.label === 'START') {
                //await getParameters(page);
                await enqueueUrlWithInputGETParameters(request.url, page, requestQueue, combinedParsedUrl);
                getUrlParameters(request.url);
                await domXssScanner.scan(request.url);
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
                const stringIsIncluded = await page.evaluate(() => {
                    return document.querySelectorAll('[data-wrtqva]').length > 0;
                });

                if (stringIsIncluded) logger.logGETXSS(request.url);
            } else if (response.headers()['content-type'].includes('text/html')) {
                
                //@ts-ignore
                const links = await page.$$eval('a', as => as.map(a => a.href));

                logger.logUrl(request.url);
                await domXssScanner.scan(request.url);
                await enqueueUrlWithInputGETParameters(request.url, page, requestQueue, combinedParsedUrl);

                for (const link of links) {
                    if (combinedParsedUrl && link.startsWith(combinedParsedUrl)) {
                        logger.logUrl(link);
                        getUrlParameters(link);
                        await domXssScanner.scan(link);
                    }
                }
            }
        };

        // Create a PuppeteerCrawler
        const crawler = new Apify.PuppeteerCrawler({
            requestList: rl,
            requestQueue,
            handlePageFunction,
            launchPuppeteerOptions: {
                useChrome: true, // removing this made it work on vps
                //@ts-ignore, option is valid, but not defined
                headless: true,
                // @ts-ignore
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                // @ts-ignore
                ignoreHTTPSErrors: true,
            },
            handleFailedRequestFunction: () => { },
            maxConcurrency: 10,
            handlePageTimeoutSecs: 5,
            gotoTimeoutSecs: 5
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