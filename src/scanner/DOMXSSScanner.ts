import { RequestQueue } from "apify";
import { Page } from "puppeteer";

export class DOMXSSScanner {
    public readonly payloads = [
        '\'" <img data-wrtqva>',
        '\');document.write(\'<img data-wrtqva>',
        '\';document.write(\'<img data-wrtqva>'];
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

        for (const payload of this.payloads) {
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
        for (const payload of this.payloads) {
            let modifiedUrl = url;
            modifiedUrl.hash = payload;
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

    public async scanPOSTListener(page: Page): Promise<boolean> {
        const payload = this.payloads[0];

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

        return xssFound;
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
}