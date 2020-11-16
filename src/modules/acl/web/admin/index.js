import Auth from "../../../../shared/lib/auth";
import template from "./template.marko";
import C from "../../../../shared/lib/constants";
import moduleData from "../../module.json";

export default routeId => ({
    async handler(req, rep) {
        try {
            const auth = new Auth(this.mongo.db, this, req, rep, C.USE_COOKIE_FOR_TOKEN);
            const site = new req.ZoiaSite(req, "acl", this.mongo.db);
            const response = new this.Response(req, rep, site);
            if (!(await auth.getUserData()) || !auth.checkStatus("admin")) {
                auth.clearAuthCookie();
                return response.redirectToLogin(req.zoiaModulesConfig["acl"].routes.admin);
            }
            site.setAuth(auth);
            const render = await template.stream({
                $global: {
                    serializedGlobals: {
                        template: true,
                        pageTitle: true,
                        routeId: true,
                        routeParams: true,
                        routes: true,
                        modules: true,
                        ...site.getSerializedGlobals()
                    },
                    template: "admin",
                    pageTitle: `${site.i18n.t("moduleTitle")} | ${site.i18n.t("adminPanel")}`,
                    routeId,
                    routeParams: req.params || {},
                    routes: {
                        ...req.zoiaModulesConfig["acl"].routes,
                        ...req.zoiaConfig.routes
                    },
                    modules: this.zoiaModules,
                    ...await site.getGlobals()
                },
                modules: req.zoiaModules,
                moduleId: moduleData.id,
            });
            return response.sendHTML(render);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});