import * as Apify from 'apify'
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import { parseContentTypeFromResponse } from 'apify/types/utils';

const lines = [];

process.setMaxListeners(Infinity);

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    lines.push(line);
}).on('close', async () => {
    Apify.main(async () => {
        const requestQueue = await Apify.openRequestQueue();
        
        lines.forEach(async line => {
            const purl = new Apify.PseudoUrl(`${line}[.*]`);

            await requestQueue.addRequest({ 
                url: line, 
                userData: { 
                    label: 'START', 
                    filter: purl,
                    baseUrl: line
                }
            })
        });

        // Create a RequestList
        // const requestList = await Apify.openRequestList('my-list', lines);
        // Function called for each URL
        const handlePageFunction = async ({ request, page }) => {
            console.log(request.url);

            const getParameters = async () => {
                return await page.evaluate(() => {
                    let parameters: Array<string> = [];

                    let setObjects: Array<Set<string>> = [];

                    for (let key in window) {
                        let value = window[key];
                        if (value instanceof Set) {
                            setObjects.push(value);
                        }
                    }

                    setObjects.forEach(set => set.forEach(value => parameters.push(value)));

                    return parameters;
                });
            }

            (await getParameters()).forEach(param => {
                writeParameterToFile(param);
            });

            if (request.userData.label === 'START') {
                // await Apify.utils.enqueueLinks({
                //     page,
                //     selector: 'a',
                //     requestQueue,
                //     pseudoUrls: scope
                // });
                console.log('enqueuing links');
                const links = await page.evaluate(() => {
                    return Array.from(document.getElementsByTagName('a'), a => a.href);
                  });

                for (let url in links) {
                    console.log('does ', url, ' start with ', request.userData.baseUrl);
                    if (!url.startsWith(request.userData.baseUrl)) return;
                    
                    await requestQueue.addRequest({
                        url,
                        userData: { 
                            label: 'SCRAPED_URL', 
                            filter: request.userData.filter,
                            baseUrl: request.userData.baseUrl
                        }
                    });
                }
            }
            else {
                const links = await page.$$eval('a', as => as.map(a => a.href));

                links.forEach(async (url: string) => {
                    if (url.startsWith(request.userData.baseUrl)) console.log(url);
                    
                    // await requestQueue.addRequest({
                    //     url,
                    //     userData: { label: 'SCRAPED_URL', filter: request.userData.filter }
                    // });
                });
            }
        };

        // Create a PuppeteerCrawler
        const crawler = new Apify.PuppeteerCrawler({
            requestQueue,
            handlePageFunction,
            launchPuppeteerOptions: {
                useChrome: true,
                //@ts-ignore, option is valid, but not defined
                headless: true,
                // @ts-ignore
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                // @ts-ignore
                ignoreHTTPSErrors: true,
            },
            handleFailedRequestFunction: () => {},
            maxConcurrency: 10
        });

        await crawler.run();
    });
});

const writeParameterToFile = async (value: string) => {
    if (value.length > 15) return;
    if (/\=\?\&\#\/\\\n/.test(value)) return;

    const writePath = './data/parameters';

    await fs.writeFile(writePath, null, { flag: 'wx' }, function (err) {
        if (err) return;
    });

    await fs.readFile(writePath, 'utf8', (err, data) => {
        let regexString = `^${value}$`;
        let re = new RegExp(regexString, 'g');
        if (err) return;
        if (re.test(data)) return;
    });

    await fs.open(writePath, 'a', 666, function (e, id) {
        fs.write(id, value + os.EOL, null, 'utf8', function () {
            fs.close(id, null);
        });
    });
}