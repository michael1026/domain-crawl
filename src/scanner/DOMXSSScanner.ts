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

    scan(url: string) {
        const parsedUrl = new URL(url);
        this.scanGetParameters(parsedUrl);
        this.scanHash(parsedUrl);
    }

    private scanGetParameters(url: URL) {
        const parameter = url.searchParams.entries().next();
        if (parameter === null) return;

        this.payloads.forEach(payload => {
            let modifiedUrl = url;
            for (const [key, value] of modifiedUrl.searchParams) {
                modifiedUrl.searchParams.set(key, value + payload);
                this.requestQueue.addRequest({
                    url: modifiedUrl.href,
                    userData: {
                        label: 'SCAN',
                        scanner: 'XSS',
                        check: 'GET'
                    }
                });
                modifiedUrl.searchParams.set(key, value);
            }
        });
    }

    private scanHash(url: URL) {
        this.payloads.forEach(payload => {
            let modifiedUrl = url;
            modifiedUrl.hash = payload;
            modifiedUrl.searchParams.append('test123', 'test123');
            this.requestQueue.addRequest({
                url: modifiedUrl.href,
                userData: {
                    label: 'SCAN',
                    scanner: 'XSS',
                    check: 'GET'
                }
            });
            modifiedUrl.searchParams.delete('test123');
        });
    }
}