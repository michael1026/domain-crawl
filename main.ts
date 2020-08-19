import * as Apify from 'apify'
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';

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
    let scope = lines.map(line => line + '[.*]');

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

            (await getParameters(page)).forEach(param => {
                writeParameterToFile(param);
            });

            if (request.userData.label === 'START') {
                await Apify.utils.enqueueLinks({
                    page,
                    selector: 'a',
                    requestQueue,
                    pseudoUrls: scope,
                    limit: 20,
                    transformRequestFunction: (request) => {
                        // @ts-ignore
                        request.userData.label = 'SECOND_LEVEL';
                        return request;
                    }
                });
            }
            else if (request.userData.label === 'SECOND_LEVEL') {
                const links = await page.$$eval('a', as => as.map(a => a.href));

                links.forEach(async (url: string) => {
                    if (!url.startsWith(request.userData.baseUrl)) return;
                    
                    await requestQueue.addRequest({
                        url,
                        userData: { filter: request.userData.filter }
                    });
                });
            }
        };

        // Create a PuppeteerCrawler
        const crawler = new Apify.PuppeteerCrawler({
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
            handleFailedRequestFunction: () => {},
            maxConcurrency: 10
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

        setObjects.forEach(set => set.forEach(value => parameters.push(value)));

        return parameters;
    });
}

const writeParameterToFile = async (value: string) => {
    if (value.length > 15) return;
    if (/[a-zA-Z0-9_\-\.]+/.test(value)) return;

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