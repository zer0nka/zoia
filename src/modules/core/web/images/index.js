import template from "./template.marko";

export default () => ({
    async handler(req) {
        try {
            const {
                response,
                auth,
            } = req.zoia;
            const site = new req.ZoiaSite(req, "core", this.mongo.db);
            response.setSite(site);
            if (!auth.checkStatus("admin")) {
                auth.clearAuthCookie();
                return response.redirectToLogin(req.zoiaConfig.routes.imagesBrowser);
            }
            site.setAuth(auth);
            const render = await template.stream({
                $global: {
                    serializedGlobals: {
                        template: true,
                        pageTitle: true,
                        ...site.getSerializedGlobals()
                    },
                    template: "admin",
                    pageTitle: site.i18n.t("moduleTitleImages"),
                    ...await site.getGlobals(),
                }
            });
            return response.sendHTML(render);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});
