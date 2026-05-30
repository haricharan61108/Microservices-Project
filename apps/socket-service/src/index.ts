import { WebSocketServer } from "ws";

const wss = new WebSocketServer({
    port: 8080
})

const clients = new Map<string, any>();

wss.on("connection", (ws)=> {
    console.log("Client Connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message.toString());

    if (data.type === "REGISTER") {

        clients.set(data.userId, ws);

        console.log(
          `User Registered: ${data.userId}`
        );
      } else {
        // Broadcast all non-REGISTER messages to the target user
        const targetWs = clients.get(data.userId);

        if(targetWs && targetWs.readyState === 1) {
          targetWs.send(JSON.stringify(data));
          console.log(`Broadcasting: ${data.type} - ${data.status || 'N/A'}`);
        } else {
          console.log(`No client connected for user: ${data.userId}`);
        }
      }

    });

    ws.on("close", () => {
        console.log("Client Disconnected");
        // Remove disconnected client from map
        for (const [userId, client] of clients.entries()) {
          if (client === ws) {
            clients.delete(userId);
            console.log(`User ${userId} removed from registry`);
          }
        }
      });
})

console.log(
  "Socket Service running on port 8080"
);

export { clients };