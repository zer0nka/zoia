import {
    ObjectId
} from "mongodb";
import Auth from "../../../shared/lib/auth";

export default async (fastify, data, socket) => {
    try {
        if (data && data.token && data.id && fastify.redis) {
            const auth = new Auth(fastify.mongo.db, fastify, null, null, data.token);
            const user = await auth.getUserData();
            if (!user || !auth.checkStatus("admin")) {
                return;
            }
            const lockData = await fastify.redis.get(`${fastify.zoiaConfig.siteOptions.id}_test_lock_${data.id}`);
            if (!lockData) {
                await fastify.redis.set(`${fastify.zoiaConfig.siteOptions.id}_test_lock_${data.id}`, user._id);
                socket.lockData = {
                    module: "test",
                    id: data.id
                };
            } else if (lockData && lockData !== String(user._id)) {
                const lockUser = await fastify.mongo.db.collection(fastify.zoiaModulesConfig["users"].collectionUsers).findOne({
                    _id: new ObjectId(lockData)
                });
                if (lockUser) {
                    socket.emit("test.alreadyLocked", lockUser.username);
                }
            } else if (lockData && lockData === String(user._id)) {
                socket.lockData = {
                    module: "test",
                    id: data.id
                };
            }
        }
    } catch (e) {
        fastify.log.error(e);
    }
};
