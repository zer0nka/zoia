import {
    ObjectId
} from "mongodb";
import cloneDeep from "lodash/cloneDeep";
import userEdit from "./data/userEdit.json";

export default () => ({
    async handler(req) {
        const {
            log,
            response,
            auth,
            acl
        } = req.zoia;
        // Check permissions
        if (!auth.checkStatus("admin")) {
            response.unauthorizedError();
            return;
        }
        const userEditRoot = cloneDeep(userEdit.root);
        userEditRoot.required = ["id"];
        const extendedValidation = new req.ExtendedValidation(req.body, userEditRoot);
        const extendedValidationResult = extendedValidation.validate();
        if (extendedValidationResult.failed) {
            log.error(null, extendedValidationResult.message);
            response.validationError(extendedValidationResult);
            return;
        }
        try {
            const user = await this.mongo.db.collection(req.zoiaModulesConfig["users"].collectionUsers).findOne({
                _id: new ObjectId(req.body.id)
            });
            if (!user) {
                response.requestError({
                    failed: true,
                    error: "Database error",
                    errorKeyword: "userNotFound",
                    errorData: []
                });
                return;
            }
            // Check permission
            if (!acl.checkPermission("users", "read", user.username)) {
                response.requestError({
                    failed: true,
                    error: "Access Denied",
                    errorKeyword: "accessDenied",
                    errorData: []
                });
                return;
            }
            delete user.password;
            user.groups = user.groups ? user.groups.join(", ") : "";
            response.successJSON({
                data: user
            });
            return;
        } catch (e) {
            log.error(e);
            response.internalServerError(e.message);
        }
    }
});
