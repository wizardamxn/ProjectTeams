import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer | undefined;

/** Real MongoDB for integration tests: TEST_MONGO_URI if set, else an in-memory server. */
export const startDb = async () => {
  const uri = process.env.TEST_MONGO_URI ?? (mongod = await MongoMemoryServer.create()).getUri();
  await mongoose.connect(uri, { dbName: `projectteams-test-${process.pid}` });
};

export const clearDb = async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

export const stopDb = async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await mongod?.stop();
};
