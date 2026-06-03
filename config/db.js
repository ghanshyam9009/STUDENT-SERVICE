import "./env.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const localEndpoint = process.env.DYNAMODB_ENDPOINT?.trim();

const clientConfig = {
  region: process.env.AWS_REGION || "ap-southeast-1",
};

if (localEndpoint) {
  clientConfig.endpoint = localEndpoint;
  clientConfig.credentials = {
    accessKeyId: "local",
    secretAccessKey: "local",
  };
  clientConfig.tls = false;
} else {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const client = new DynamoDBClient(clientConfig);
const ddbDocClient = DynamoDBDocumentClient.from(client);

export default ddbDocClient;
export { client, ddbDocClient };
