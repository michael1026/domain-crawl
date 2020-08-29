import { RequestQueue } from "apify";
import { Page } from "puppeteer";
import * as Apify from 'apify'
import { Logger } from "../utils/logger";
import { showCompletionScript } from "yargs";

const payloads = [
    '\'" <img data-wrtqva>',
    '\');document.write(\'<img data-wrtqva>',
    '\';document.write(\'<img data-wrtqva>',
    '\'" <img/data-wrtqva>'];

enum DetectionStrings {
    AngularJSTemplatePayload = 'wrtqva{{5*5}}',
    AngularJSDetectionKeyword = 'wrtqva25',
    XSSDetectionSelector = '[data-wrtqva]'
}

export class DOMXSSScanner {
    requestQueue: RequestQueue;

    constructor(requestQueue: RequestQueue) {
        this.requestQueue = requestQueue;
    }

    async scan(url: string) {
        const parsedUrl = new URL(url);
        await this.scanGetParameters(parsedUrl);
        await this.scanHash(parsedUrl);
    }

    private async scanGetParameters(url: URL) {
        const parameter = url.searchParams.entries().next();
        if (parameter === null) return;

        for (const payload of payloads) {
            let modifiedUrl = url;
            for (const [key, value] of modifiedUrl.searchParams) {
                modifiedUrl.searchParams.set(key, value + payload);
                await this.requestQueue.addRequest({
                    url: modifiedUrl.href,
                    userData: {
                        label: 'SCAN',
                        scanner: 'XSS',
                        check: 'GET'
                    }
                });
                modifiedUrl.searchParams.set(key, value);
            }
        }
    }

    private async scanHash(url: URL) {
        for (const payload of payloads) {
            let modifiedUrl = url;
            modifiedUrl.hash = payload;
            // we need to add a parameter so that it's recognized as a new request
            // not a duplicate
            modifiedUrl.searchParams.append('test123', 'test123');
            await this.requestQueue.addRequest({
                url: modifiedUrl.href,
                userData: {
                    label: 'SCAN',
                    scanner: 'XSS',
                    check: 'GET'
                }
            });
            modifiedUrl.searchParams.delete('test123');
        }
    }

    public async scanPOSTListener(page: Page, logger: Logger) {
        const payload = payloads[0];

        await page.evaluate((payload) => {
            window.postMessage(payload, window.location.href);
        }, payload);

        const xssFound = await page.evaluate(() => {
            let result = false;

            if (document.querySelectorAll('[data-wrtqva]').length > 0) {
                result = true;
            }

            return result;
        });

        if (!xssFound) {
            return;
        }

        logger.logPOSTListenerXSS(page.url());
    }

    public async scanAngularJS(page: Page): Promise<boolean> {
        const url = new URL(page.url());
        const payload = 'wrtqva{{5*5}}';
        let angular;

        const angularJSFound = await page.evaluate(() => typeof angular !== 'undefined');

        if (!angularJSFound) {
            return;
        }

        for (const [key, value] of url.searchParams) {
            url.searchParams.set(key, value + payload);
            await this.requestQueue.addRequest({
                url: url.href,
                userData: {
                    label: 'SCAN',
                    scanner: 'XSS',
                    check: 'AngularJS'
                }
            });
            url.searchParams.set(key, value);
        }
    }

    public async checkResponse(page: Page, request: Apify.Request, logger: Logger) {
        if (request.userData.check === 'GET') {
            const stringIsIncluded = await page.evaluate(() => {
                return document.querySelectorAll('[data-wrtqva]').length > 0;
            });

            if (stringIsIncluded) {
                logger.logGETXSS(request.url);
            }
        } else if (request.userData.check === 'AngularJS') {
            await page.waitFor(5000);
            const contents = await page.content();

            if (contents.includes('wrtqva25')) {
                logger.logAngularJSTemplateInjection(request.url);
            }
        }
    }
}