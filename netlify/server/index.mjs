import { createServer } from "node:http";
import { getStore } from "@netlify/blobs";
import backend from "../../backend/server.js";

backend.configureNetlifyStore(
    getStore({ name: "techsolve-data", consistency: "strong" })
);

export default createServer(backend.handleRequest);