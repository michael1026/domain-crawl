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

    public logPOSTListenerXSS(url: string) {
        console.log('[PostMessage XSS]', url);
    }

    public logS3Url(sourceUrl: string, resourceUrl: string) {
        console.log(`[S3:${sourceUrl}]`, resourceUrl);
    }

    public logAngularJSTemplateInjection(url: string) {
        console.log('[Template-Injection:AngularJS]', url);
    }

    public logExperimentalDOMPoisoningXSS(url: string) {
        console.log(`[XSS:Experimental]`, url);
    }
}