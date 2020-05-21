import Auth from "../../../../shared/lib/auth";

export default fastify => ({
    async handler(req, rep) {
        const auth = new Auth(this.mongo.db, fastify, req, rep);
        const site = new req.ZoiaSite(req, "users");
        try {
            await auth.logout();
            return rep.redirectToRoot(req, rep, site);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});