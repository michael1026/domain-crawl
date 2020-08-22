export class Logger {
    public logUrl(url: string) {
        console.log('[Url]', url);
    }

    public logParameter(parameter: string) {
        console.log('[Parameter]', parameter);
    }

    public logGETXSS(url: string) {
        console.log('[XSS]', url);
    }
}