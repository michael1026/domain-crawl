import { RequestQueue } from "apify";

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
}