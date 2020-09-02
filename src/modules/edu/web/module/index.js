import template from "./index.marko";
import Auth from "../../../../shared/lib/auth";

export default (programs) => ({
    async handler(req, rep) {
        if (!req.params || !req.params.programId || !programs[req.params.programId] || !req.params.moduleId) {
            rep.callNotFound();
            return rep.code(204);
        }
        const moduleData = programs[req.params.programId].modules.find(m => m.id === req.params.moduleId);
        if (!moduleData) {
            rep.callNotFound();
            return rep.code(204);
        }
        const auth = new Auth(this.mongo.db, this, req, rep);
        const site = new req.ZoiaSite(req, "edu");
        if (!(await auth.getUserData()) || !auth.checkStatus("active")) {
            auth.clearAuthCookie();
            return rep.redirectToLogin(req, rep, site, req.zoiaModulesConfig["edu"].routes.index);
        }
        try {
            const render = await template.stream({
                $global: {
                    serializedGlobals: {
                        template: true,
                        pageTitle: true,
                        program: true,
                        routes: true,
                        programId: true,
                        moduleData: true,
                        moduleId: true,
                        ...site.getSerializedGlobals()
                    },
                    template: req.zoiaTemplates.available[0],
                    pageTitle: site.i18n.t("programs"),
                    programId: req.params.programId,
                    program: programs[req.params.programId],
                    moduleData,
                    moduleId: req.params.moduleId,
                    routes: {
                        ...req.zoiaModulesConfig["edu"].routes,
                    },
                    ...site.getGlobals(),
                }
            });
            return rep.sendHTML(rep, render);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});
